import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  AiExtractionParams,
  AiExtractionResult,
  AiProviderInterface,
  AiProviderType,
} from '../ai.interfaces';
import { JsonSanitizerUtil } from '../utils/json-sanitizer.util';

@Injectable()
export class OpenaiProvider implements AiProviderInterface {
  readonly providerType: AiProviderType = 'openai';
  private readonly logger = new Logger(OpenaiProvider.name);
  private client: OpenAI | null = null;
  private readonly apiKey: string;
  private readonly defaultModel: string;
  private readonly availableModels = [
    'gpt-5',
    'gpt-5-nano',
    'gpt-5-mini',
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4.5-preview',
    'chatgpt-4o-latest',
    'o3-mini',
    'o1',
    'o1-mini',
    'o1-preview',
    'gpt-4-turbo',
    'gpt-4.1',
    'gpt-4.1-mini',
    'gpt-4',
    'gpt-3.5-turbo',
  ];

  constructor(private config: ConfigService) {
    this.apiKey = this.config.get<string>('openai.apiKey') || '';
    this.defaultModel =
      this.config.get<string>('openai.summaryModel') || 'gpt-4o-mini';

    if (this.isAvailable()) {
      this.client = new OpenAI({ apiKey: this.apiKey });
    }
  }

  isAvailable(): boolean {
    return (
      !!this.apiKey &&
      this.apiKey !== 'your_openai_api_key_here' &&
      this.apiKey.trim().length > 0
    );
  }

  getDefaultModel(): string {
    return this.defaultModel;
  }

  getAvailableModels(): string[] {
    return this.availableModels;
  }

  private getClient(): OpenAI {
    if (!this.client && this.isAvailable()) {
      this.client = new OpenAI({ apiKey: this.apiKey });
    }
    if (!this.client) {
      throw new Error(
        'OpenAI provider is not configured. Please set OPENAI_API_KEY in your environment.',
      );
    }
    return this.client;
  }

  async generateExtraction(
    params: AiExtractionParams,
  ): Promise<AiExtractionResult> {
    const client = this.getClient();
    const modelToUse = params.specificModel || this.defaultModel;
    const userPrompt = `Aplica el siguiente prompt al siguiente texto de transcripción y elimina cualquier texto que este antes o despues de la estructura json\n\nPrompt: ${params.prompt}\nTranscripción: ${JSON.stringify(params.transcription)}`;

    this.logger.debug(
      `Generating extraction with OpenAI model: ${modelToUse} for ${params.modelName || 'unnamed'}`,
    );

    const requestBody: any = {
      model: modelToUse,
      messages: [{ role: 'user', content: userPrompt }],
    };

    // Models like o1, o3, o4, gpt-5 only support default temperature (1) or reject temperature != 1
    const isReasoningOrFixedTempModel = /^(o1|o3|o4|gpt-5)/i.test(modelToUse);
    if (!isReasoningOrFixedTempModel) {
      requestBody.temperature = 0.2;
    }

    let response: any;
    try {
      response = await client.chat.completions.create(requestBody);
    } catch (error: any) {
      if (error?.message?.includes('temperature') && 'temperature' in requestBody) {
        this.logger.warn(
          `Model ${modelToUse} does not support custom temperature: ${error.message}. Retrying without temperature parameter.`,
        );
        delete requestBody.temperature;
        response = await client.chat.completions.create(requestBody);
      } else {
        throw error;
      }
    }

    const raw = this.getCompletionContent(response).trim();
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
    const modelToUse =
      specificModel ||
      this.config.get<string>('openai.contextModel') ||
      'gpt-4o-mini';

    const systemPrompt =
      'Eres un asistente generador de prompts para mejorar la creacion de estos a partir de un objetivo dado. Devuelve solo el prompt generado sin ningun tipo de explicacion alguna ni texto adicioinal';

    const requestBody: any = {
      model: modelToUse,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Objetivo del usuario: "${goal}"` },
      ],
    };

    const isReasoningOrFixedTempModel = /^(o1|o3|o4|gpt-5)/i.test(modelToUse);
    if (!isReasoningOrFixedTempModel) {
      requestBody.temperature = 0.2;
    }

    let response: any;
    try {
      response = await client.chat.completions.create(requestBody);
    } catch (error: any) {
      if (error?.message?.includes('temperature') && 'temperature' in requestBody) {
        this.logger.warn(
          `Model ${modelToUse} does not support custom temperature: ${error.message}. Retrying without temperature parameter.`,
        );
        delete requestBody.temperature;
        response = await client.chat.completions.create(requestBody);
      } else {
        throw error;
      }
    }

    return {
      prompt: this.getCompletionContent(response).trim(),
    };
  }

  private getCompletionContent(response: any): string {
    const content = response?.choices?.[0]?.message?.content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (typeof part === 'string') return part;
          if (part && typeof part === 'object' && 'text' in part) {
            return String((part as { text?: unknown }).text ?? '');
          }
          return '';
        })
        .join('');
    }
    return '';
  }
}
