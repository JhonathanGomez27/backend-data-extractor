import { Inject, Injectable, NotFoundException, Scope, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ModelEntity } from './model.entity';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { REQUEST as REQ } from '@nestjs/core';
import { CreateModelDto } from './dto/create-model.dto';
import { PaginatorDto } from 'src/common/paginator/paginator.dto';
import { OpenaiService } from 'src/openai/openai.service';
import { AiService } from 'src/ai/ai.service';
import { ExtractionLogsService } from 'src/extraction-logs/extraction-logs.service';
import { TelegramService } from 'src/telegram/telegram.service';

import { ClientEntity } from 'src/clients/client.entity';
import { BulkUpdateAiDto } from './dto/bulk-update-ai.dto';

type ModuleDef = {
  key: string;
  enabled: boolean;
  config: Record<string, any>;
  version?: string;
};
type Template = { templateName: string; modules: ModuleDef[] };

@Injectable({ scope: Scope.REQUEST })
export class ModelsService {
  private readonly logger = new Logger(ModelsService.name);

  constructor(
    @InjectRepository(ModelEntity) private repo: Repository<ModelEntity>,
    @InjectRepository(ClientEntity) private clientRepo: Repository<ClientEntity>,
    @Inject(REQ) private request: any,
    private openaiService: OpenaiService,
    private aiService: AiService,
    private extractionLogsService: ExtractionLogsService,
    private telegramService: TelegramService,
  ) { }

  create(dto: CreateModelDto) {
    // Solo admin (JWT) llega aquí
    return this.repo.save(this.repo.create(dto));
  }

  async updateModel(id: string, dto: CreateModelDto) {
    const model = await this.repo.findOne({ where: { id } });
    if (!model) throw new NotFoundException();
    Object.assign(model, dto);

    //update timestamp
    model.updatedAt = new Date();

    return this.repo.save(model);
  }

  async listModels(paginatorDto: PaginatorDto) {
    const where: FindOptionsWhere<ModelEntity> = {};
    if (paginatorDto.clientId) where.clientId = paginatorDto.clientId;

    const { page = 1, limit = 10, searchText } = paginatorDto;
    if (searchText) (where as any).name = ILike(`%${searchText}%`);

    const [items, total] = await this.repo.findAndCount({
      where,
      select: [
        'id',
        'name',
        'description',
        'clientId',
        'status',
        'modelTypeId',
        'provider',
        'aiModel',
        'createdAt',
        'updatedAt'
      ],
      relations: ['modelType', 'client'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return {
      data: items,
      total,
      page,
      limit,
    };
  }

  async bulkUpdateAiConfigForClient(
    clientId: string,
    dto: BulkUpdateAiDto,
  ): Promise<{ updated: number }> {
    const updateData: any = {
      provider: dto.provider,
      updatedAt: new Date(),
    };
    if (dto.aiModel !== undefined) {
      updateData.aiModel = dto.aiModel || null;
    }

    const result = await this.repo.update({ clientId }, updateData);
    this.logger.log(
      `Bulk updated ${result.affected || 0} models for client ${clientId} to provider: ${dto.provider} (model: ${dto.aiModel || 'default'})`,
    );

    return { updated: result.affected || 0 };
  }

  getAiProviders() {
    return this.aiService.getProvidersInfo();
  }

  async listAdmin({ clientId }: { clientId?: string }) {
    const where: FindOptionsWhere<ModelEntity> = {};
    if (clientId) where.clientId = clientId;
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  async listForClient(paginatorDto: PaginatorDto) {
    const { page = 1, limit = 10, searchText } = paginatorDto;

    const where: FindOptionsWhere<ModelEntity> = {
      clientId: this.request.user?.clientId as string,
    };
    if (searchText) (where as any).name = ILike(`%${searchText}%`);

    const clientId = this.request.user?.clientId as string;

    const [items, total] = await this.repo.findAndCount({
      where,
      select: [
        'id',
        'name',
        'description',
        'clientId',
        'modelTypeId',
        'provider',
        'aiModel',
        'createdAt',
      ],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return {
      data: items,
      total,
      page,
      limit,
    };
  }

  async getForClient(id: string) {
    const clientId = this.request.user?.clientId as string;
    const where: FindOptionsWhere<ModelEntity> = { id };
    if (clientId) {
      where.clientId = clientId;
    }
    const m = await this.repo.findOne({
      where,
      relations: ['modelType'],
    });
    if (!m) throw new NotFoundException();
    return m;
  }

  async extractModelForClient(
    transcripcion: any,
    audio_source_value: string
  ) {
    const clientId = this.request.user?.clientId as string;
    const startTime = Date.now();

    this.logger.log(`Starting extraction for client: ${clientId}`);

    try {
      // Get client configuration to support inheritance
      const client = await this.clientRepo.findOne({
        where: { id: clientId },
        select: { id: true, name: true, provider: true, aiModel: true },
      });

      // Get active models for the client
      const models = await this.repo.find({
        where: { clientId, status: 'active' }, relations: ['modelType']
      });

      if (models.length === 0) {
        throw new NotFoundException('No active models found for the client');
      }

      this.logger.log(
        `Found ${models.length} active models for client ${clientId} (client default provider: ${client?.provider || 'default'}, model: ${client?.aiModel || 'default'})`,
      );

      // Calcular tamaño de la transcripción
      const transcriptionSize = JSON.stringify(transcripcion).length;

      // Ejecutar extracciones con concurrencia controlada (máximo 2 a 3 simultáneas)
      // Esto permite que el 1er modelo inicialice el Prompt Cache de Anthropic/OpenAI
      // y los siguientes modelos obtengan Cache Hit inmediato sin saturar la conexión.
      const responses = await this.mapWithConcurrency(models, 2, async (model) => {
        // Resolve effective provider & model: model-specific override > client setting > global default
        const effectiveProvider = (model.provider && model.provider !== 'inherit')
          ? model.provider
          : (client?.provider || undefined);

        const effectiveAiModel = (model.aiModel && model.aiModel !== 'inherit')
          ? model.aiModel
          : (client?.aiModel || undefined);

        this.logger.debug(
          `Processing model: ${model.name} (${model.id}) with provider: ${effectiveProvider || 'default'} (model: ${effectiveAiModel || 'default'}, declared on model: ${model.provider || 'none'})`,
        );
        const response = await this.retryGenerateExtraction(
          model.description,
          transcripcion,
          model.name,
          3,
          audio_source_value,
          effectiveProvider,
          effectiveAiModel,
        );
        return { name: model.modelType.name, payload: response.response };
      });

      const result = responses.reduce<Record<string, any>>((acc, item) => {
        acc[item.name] = item.payload;
        return acc;
      }, {});

      const durationMs = Date.now() - startTime;

      // Guardar log exitoso
      await this.extractionLogsService.createLog({
        clientId,
        modelsUsed: models.map((m) => ({
          id: m.id,
          name: m.name,
          description: m.description,
          provider: m.provider,
          aiModel: m.aiModel,
        })),
        transcriptionSize,
        durationMs,
        audio_source_value,
        status: 'success',
        response: result,
        metadata: {
          modelCount: models.length,
          responseKeys: Object.keys(result),
          providersUsed: Array.from(
            new Set(models.map((m) => m.provider || 'openai')),
          ),
        },
      });

      this.logger.log(`Extraction completed successfully for client ${clientId} in ${durationMs}ms`);

      return result;
    } catch (error : any) {
      const durationMs = Date.now() - startTime;
      const transcriptionSize = JSON.stringify(transcripcion).length;

      this.logger.error(`Extraction failed for client ${clientId}: ${error.message}`, error.stack);

      // Intentar obtener modelos para el log de error
      let modelsUsed = [];
      try {
        const models = await this.repo.find({
          where: { clientId, status: 'active' },
        });
        modelsUsed = models.map((m) => ({
          id: m.id,
          name: m.name,
          description: m.description,
        }));
      } catch (e) {
        this.logger.warn('Could not retrieve models for error log');
      }

      // Guardar log de error
      await this.extractionLogsService.createLog({
        clientId,
        modelsUsed,
        transcriptionSize,
        durationMs,
        audio_source_value,
        status: 'error',
        errorMessage: error.message,
        metadata: {
          errorStack: error.stack,
          errorName: error.name,
        },
      });

      // Enviar alerta a Telegram
      await this.telegramService.sendTelegramAlert({
        title: 'Error en Extracción de Modelos',
        message: `Falló la extracción para el cliente ${clientId}`,
        error,
        extra: {
          clientId,
          audio_source_value,
          transcriptionSize,
          durationMs,
          modelsCount: modelsUsed.length,
          models: modelsUsed.map(m => m.name).join(', '),
        },
        level: 'ERROR',
      });

      throw error;
    }
  }

  mergeTemplates(templates: Template[]): Template {
    if (!templates || templates.length === 0) {
      throw new Error('No templates provided to merge');
    }

    const modulesMap = new Map<string, ModuleDef>();
    const order: string[] = [];

    for (const t of templates) {
      // Validar que el template tenga módulos
      if (!t.modules || !Array.isArray(t.modules)) {
        console.warn(`Template "${t.templateName}" has no valid modules`);
        continue;
      }

      for (const m of t.modules) {
        // Validar estructura del módulo
        if (!m.key) {
          console.warn('Module without key found, skipping');
          continue;
        }

        const prev = modulesMap.get(m.key);
        if (!prev) {
          modulesMap.set(m.key, {
            key: m.key,
            enabled: m.enabled ?? true,
            config: m.config ?? {},
            version: m.version,
          });
          order.push(m.key);
        } else {
          modulesMap.set(m.key, {
            key: m.key,
            enabled: m.enabled ?? prev.enabled, // Si no viene, mantener el previo
            version: m.version ?? prev.version,
            config: this.deepMergeConfigs(prev.config ?? {}, m.config ?? {}),
          });
        }
      }
    }

    return {
      templateName: templates
        .map((t) => t.templateName || 'Unnamed')
        .join(' + '),
      modules: order.map((k) => modulesMap.get(k)!).filter(Boolean),
    };
  }

  deepMergeConfigs(a: any, b: any): any {
    if (Array.isArray(a) && Array.isArray(b)) {
      // Regla: arrays se sobrescriben por completo
      return b;
    }
    if (this.isObject(a) && this.isObject(b)) {
      const out: Record<string, any> = { ...a };
      for (const k of Object.keys(b)) {
        out[k] = k in a ? this.deepMergeConfigs(a[k], b[k]) : b[k];
      }
      return out;
    }
    // tipos primitivos o diferentes → b gana
    return b;
  }

  isObject(x: any) {
    return x && typeof x === 'object' && !Array.isArray(x);
  }

  /**
   * Retry helper for AI generateExtraction calls across providers (OpenAI, Gemini, Claude)
   * Attempts up to maxRetries times with exponential backoff
   */
  private async retryGenerateExtraction(
    prompt: string,
    transcripcion: any,
    model_name: string = '',
    maxRetries: number = 3,
    audio_source_value: string = '',
    provider?: 'openai' | 'gemini' | 'claude',
    aiModel?: string,
  ): Promise<{ response: any }> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.debug(
          `Attempt ${attempt}/${maxRetries} for ${model_name} generateExtraction via ${provider || 'default'}`,
        );
        const result = await this.aiService.generateExtraction(
          {
            prompt,
            transcription: transcripcion,
            modelName: model_name,
            audioSource: audio_source_value,
            specificModel: aiModel,
          },
          provider,
          aiModel,
        );

        if (attempt > 1) {
          this.logger.log(
            `Successfully generated extraction on ${model_name} attempt ${attempt} (${result.provider}/${result.model})`,
          );
        }

        return { response: result.response };
      } catch (error: any) {
        lastError = error;
        this.logger.warn(
          `Attempt ${attempt}/${maxRetries} failed for ${model_name} generateExtraction (${provider || 'default'}): ${error.message}`,
        );

        // If this is not the last attempt, wait before retrying
        if (attempt < maxRetries) {
          const delayMs = Math.pow(2, attempt - 1) * 1000; // Exponential backoff: 1s, 2s, 4s
          this.logger.debug(`Waiting ${delayMs}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    // If all retries failed, throw the last error
    const finalError =
      lastError || new Error('All retries failed but no error was captured');

    this.logger.error(
      `All ${maxRetries} attempts failed for ${model_name} generateExtraction via ${provider || 'default'}`,
      finalError.stack,
    );

    // Enviar alerta a Telegram por reintentos agotados
    await this.telegramService.sendTelegramAlert({
      title: 'Reintentos Agotados - AI Extraction',
      message: `Fallaron todos los ${maxRetries} intentos para el modelo: ${model_name} (Proveedor: ${provider || 'default'})`,
      error: finalError,
      extra: {
        modelName: model_name,
        provider: provider || 'default',
        aiModel: aiModel || 'default',
        maxRetries,
        clientId: this.request.user?.clientId,
      },
      level: 'CRITICAL',
    });

    throw finalError;
  }

  /**
   * Helper para ejecutar operaciones asíncronas con concurrencia limitada
   */
  private async mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<R>,
  ): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let currentIndex = 0;

    const workers = Array.from(
      { length: Math.min(limit, items.length) },
      async () => {
        while (currentIndex < items.length) {
          const index = currentIndex++;
          results[index] = await fn(items[index]);
        }
      },
    );

    await Promise.all(workers);
    return results;
  }
}
