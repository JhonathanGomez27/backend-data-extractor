import { Inject, Injectable, NotFoundException, Scope } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ModelEntity } from './model.entity';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { REQUEST as REQ } from '@nestjs/core';
import { CreateModelDto } from './dto/create-model.dto';
import { PaginatorDto } from 'src/common/paginator/paginator.dto';
import { OpenaiService } from 'src/openai/openai.service';

type ModuleDef = {
  key: string;
  enabled: boolean;
  config: Record<string, any>;
  version?: string;
};
type Template = { templateName: string; modules: ModuleDef[] };

@Injectable({ scope: Scope.REQUEST })
export class ModelsService {
  constructor(
    @InjectRepository(ModelEntity) private repo: Repository<ModelEntity>,
    @Inject(REQ) private request: any,
    private openaiService: OpenaiService,
  ) { }

  create(dto: CreateModelDto) {
    // Solo admin (JWT) llega aquí
    return this.repo.save(this.repo.create(dto));
  }

  async updateModel(id: string, dto: CreateModelDto) {
    const model = await this.repo.findOne({ where: { id } });
    if (!model) throw new NotFoundException();
    Object.assign(model, dto);
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
        'createdAt',
      ],
      relations: ['modelType'],
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
    const m = await this.repo.findOne({
      where: { id, clientId },
      relations: ['modelType'],
    });
    if (!m) throw new NotFoundException();
    return m;
  }

  async extractModelForClient(
    transcripcion: any,
    config_global: Record<string, any> = {}
  ) {
    const clientId = this.request.user?.clientId as string;

    // Get active models for the client
    const models = await this.repo.find({
      where: { clientId, status: 'active' },
    });

    if (models.length === 0) {
      throw new NotFoundException('No active models found for the client');
    }

    const jsonResponse: any = {};

    for (const model of models) {
      const response = await this.openaiService.generateExtraction(
        model.description,
        transcripcion,
      );
      jsonResponse[model.name] = response.response;
    }

    const result = jsonResponse;
    return result;
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
}
