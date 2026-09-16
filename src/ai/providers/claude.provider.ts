import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import {
  AiExtractionParams,
  AiExtractionResult,
  AiProviderInterface,
  AiProviderType,
} from '../ai.interfaces';
import { JsonSanitizerUtil } from '../utils/json-sanitizer.util';

@Injectable()
export class ClaudeProvider implements AiProviderInterface {
  readonly providerType: AiProviderType = 'claude';
  private readonly logger = new Logger(ClaudeProvider.name);
  private client: Anthropic | null = null;
  private readonly apiKey: string;
  private readonly defaultModel: string;
  private readonly availableModels = [
    'claude-3-7-sonnet-latest',
    'claude-3-7-sonnet-20250219',
    'claude-3-5-sonnet-latest',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-sonnet-20240620',
    'claude-3-5-haiku-latest',
    'claude-3-5-haiku-20241022',
    'claude-haiku-4-5-20251001',
    'claude-3-haiku-20240307',
    'claude-3-opus-latest',
    'claude-3-opus-20240229',
    'claude-sonnet-5',
    'claude-opus-5',
  ];

  constructor(private config: ConfigService) {
    this.apiKey = this.config.get<string>('anthropic.apiKey') || '';
    this.defaultModel =
      this.config.get<string>('anthropic.defaultModel') ||
      'claude-3-7-sonnet-latest';

    if (this.isAvailable()) {
      this.client = new Anthropic({ apiKey: this.apiKey });
    }
  }

  isAvailable(): boolean {
    return (
      !!this.apiKey &&
      this.apiKey !== 'your_anthropic_api_key_here' &&
      this.apiKey.trim().length > 0
    );
  }

  getDefaultModel(): string {
    return this.defaultModel;
  }

  getAvailableModels(): string[] {
    return this.availableModels;
  }

  private getClient(): Anthropic {
    if (!this.client && this.isAvailable()) {
      this.client = new Anthropic({ apiKey: this.apiKey });
    }
    if (!this.client) {
      throw new Error(
        'Claude/Anthropic provider is not configured. Please set ANTHROPIC_API_KEY in your environment.',
      );
    }
    return this.client;
  }

  async generateExtraction(
    params: AiExtractionParams,
  ): Promise<AiExtractionResult> {
    const client = this.getClient();
    const modelToUse = params.specificModel || this.defaultModel;

    this.logger.debug(
      `Generating extraction with Claude model: ${modelToUse} for ${params.modelName || 'unnamed'}`,
    );

    const isThinkingModel =
      /3-7|sonnet-5|opus-5/i.test(modelToUse);

    const formattedTranscription =
      typeof params.transcription === 'string'
        ? params.transcription
        : JSON.stringify(params.transcription, null, 2);

    const requestBody: any = {
      model: modelToUse,
      max_tokens: isThinkingModel ? 8192 : 4096,
      system: [
        {
          type: 'text',
          text: 'Eres un sistema experto de extracción de datos estructurados. Tu objetivo es procesar la transcripción y aplicar las instrucciones para devolver EXCLUSIVAMENTE un JSON válido (objeto o array) que contenga la información extraída. NO agregues introducciones, explicaciones, markdown decorativo ni texto fuera del JSON.',
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Transcripción:\n${formattedTranscription}`,
              cache_control: { type: 'ephemeral' },
            },
            {
              type: 'text',
              text: `Instrucciones de extracción:\n${params.prompt}\n\nGenera el JSON final resultante:`,
            },
          ],
        },
      ],
    };

    if (isThinkingModel) {
      requestBody.thinking = {
        type: 'enabled',
        budget_tokens: 2048,
      };
      // Note: temperature cannot be set when thinking is enabled in Anthropic
    } else {
      const isFixedTempOrDeprecated = /^(claude-.*-5|claude-5)/i.test(modelToUse);
      if (!isFixedTempOrDeprecated) {
        requestBody.temperature = 0.2;
      }
    }

    let message: any;
    try {
      message = await client.messages.create(requestBody);
    } catch (error: any) {
      const errMsg = error?.message || JSON.stringify(error);
      if (
        (errMsg.includes('temperature') || errMsg.includes('thinking')) &&
        ('temperature' in requestBody || 'thinking' in requestBody)
      ) {
        this.logger.warn(
          `Model ${modelToUse} parameter adjustment needed: ${error.message}. Retrying with safe defaults.`,
        );
        delete requestBody.temperature;
        delete requestBody.thinking;
        requestBody.max_tokens = 4096;
        message = await client.messages.create(requestBody);
      } else {
        throw error;
      }
    }

    // Inspect usage and cache metrics
    const usage = (message as any)?.usage;
    if (usage) {
      if (usage.cache_read_input_tokens) {
        this.logger.debug(
          `[Claude Cache] Read ${usage.cache_read_input_tokens} tokens from cache for ${params.modelName || 'unnamed'}`,
        );
      }
      if (usage.cache_creation_input_tokens) {
        this.logger.debug(
          `[Claude Cache] Wrote ${usage.cache_creation_input_tokens} tokens to cache for ${params.modelName || 'unnamed'}`,
        );
      }
    }

    // Log thinking if present
    const thinkingText = this.extractThinkingFromContent(message.content);
    if (thinkingText) {
      this.logger.debug(
        `[Claude Thinking] Generated reasoning (${thinkingText.length} chars) for ${params.modelName || 'unnamed'}`,
      );
    }

    if (message.stop_reason === 'max_tokens') {
      this.logger.warn(
        `Claude (${modelToUse}) reached max_tokens limit for ${params.modelName || 'unnamed'}. Output may be truncated.`,
      );
    }

    const raw = this.extractTextFromContent(message.content).trim();
    if (!raw) {
      throw new Error(
        `El modelo Claude (${modelToUse}) devolvió una respuesta de texto vacía (stop_reason: ${message.stop_reason}). Si hubo razonamiento extenso, se aumentó el límite de tokens para el próximo intento.`,
      );
    }

    const sanitized = JsonSanitizerUtil.sanitizeJsonResponse(raw);
    const parsed = JsonSanitizerUtil.parsePossiblyChunkedJson(sanitized);

    return {
      response: parsed,
      rawText: raw,
      provider: this.providerType,
      model: modelToUse,
    };
  }

  async generatePrompt(
    goal: string,
    specificModel?: string,
  ): Promise<{ prompt: string }> {
    const client = this.getClient();
    const modelToUse = specificModel || this.defaultModel;
    const systemPrompt =
      'Eres un asistente generador de prompts para mejorar la creacion de estos a partir de un objetivo dado. Devuelve solo el prompt generado sin ningun tipo de explicacion alguna ni texto adicional.';

    const requestBody: any = {
      model: modelToUse,
      max_tokens: 2048,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: `Objetivo del usuario: "${goal}"` }],
    };

    const isFixedTempOrDeprecated = /^(claude-.*-5|claude-5|claude-3-7)/i.test(modelToUse);
    if (!isFixedTempOrDeprecated) {
      requestBody.temperature = 0.2;
    }

    let message: any;
    try {
      message = await client.messages.create(requestBody);
    } catch (error: any) {
      if (
        (error?.message?.includes('temperature') ||
          JSON.stringify(error)?.includes('temperature')) &&
        'temperature' in requestBody
      ) {
        this.logger.warn(
          `Model ${modelToUse} does not support custom temperature: ${error.message}. Retrying without temperature parameter.`,
        );
        delete requestBody.temperature;
        message = await client.messages.create(requestBody);
      } else {
        throw error;
      }
    }

    return {
      prompt: this.extractTextFromContent(message.content).trim(),
    };
  }

  private extractTextFromContent(content: any[]): string {
    if (!Array.isArray(content)) return '';
    return content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');
  }

  private extractThinkingFromContent(content: any[]): string {
    if (!Array.isArray(content)) return '';
    return content
      .filter((block) => block.type === 'thinking')
      .map((block) => block.thinking)
      .join('\n');
  }
}
