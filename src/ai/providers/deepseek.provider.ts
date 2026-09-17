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
export class DeepseekProvider implements AiProviderInterface {
  readonly providerType: AiProviderType = 'deepseek';
  private readonly logger = new Logger(DeepseekProvider.name);
  private client: OpenAI | null = null;
  private readonly apiKey: string;
  private readonly defaultModel: string;
  private readonly baseUrl: string;
  private readonly availableModels = [
    'deepseek-chat',
    'deepseek-reasoner',
    'deepseek-v4-flash',
    'deepseek-v4-pro',
    'deepseek-flash',
  ];

  constructor(private config: ConfigService) {
    this.apiKey = this.config.get<string>('deepseek.apiKey') || '';
    this.defaultModel =
      this.config.get<string>('deepseek.defaultModel') || 'deepseek-chat';
    this.baseUrl =
      this.config.get<string>('deepseek.baseUrl') || 'https://api.deepseek.com';

    if (this.isAvailable()) {
      this.client = new OpenAI({
        apiKey: this.apiKey,
        baseURL: this.baseUrl,
      });
    }
  }

  isAvailable(): boolean {
    return (
      !!this.apiKey &&
      this.apiKey !== 'your_deepseek_api_key_here' &&
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
      this.client = new OpenAI({
        apiKey: this.apiKey,
        baseURL: this.baseUrl,
      });
    }
    if (!this.client) {
      throw new Error(
        'DeepSeek provider is not configured. Please set DEEPSEEK_API_KEY in your environment.',
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
      `Generating extraction with DeepSeek model: ${modelToUse} for ${params.modelName || 'unnamed'}`,
    );

    const formattedTranscription =
      typeof params.transcription === 'string'
        ? params.transcription
        : JSON.stringify(params.transcription, null, 2);

    const systemPrompt =
      'Eres un extractor de información estructurada en formato JSON. Responde EXCLUSIVAMENTE con el JSON resultante (objeto o array) según las instrucciones dadas. No incluyas explicaciones ni markdown decorativo fuera del JSON.';

    const userInput = `Transcripción:\n${formattedTranscription}\n\nInstrucciones:\n${params.prompt}\n\nDevuelve exclusivamente el JSON:`;

    let raw = '';

    // 1. Intentar primero con DeepSeek Responses API (https://api-docs.deepseek.com/guides/responses_api)
    try {
      this.logger.debug(
        `Executing DeepSeek Responses API request with model: ${modelToUse}`,
      );

      const response: any = await client.responses.create({
        model: modelToUse,
        instructions: systemPrompt,
        input: userInput,
      });

      raw = response?.output_text?.trim() || '';

      const usage = response?.usage;
      if (usage?.input_tokens_details?.cached_tokens) {
        this.logger.debug(
          `[DeepSeek Cache] Read ${usage.input_tokens_details.cached_tokens} cached tokens for ${params.modelName || 'unnamed'}`,
        );
      }
      if (usage?.output_tokens_details?.reasoning_tokens) {
        this.logger.debug(
          `[DeepSeek Reasoning] Generated ${usage.output_tokens_details.reasoning_tokens} reasoning tokens for ${params.modelName || 'unnamed'}`,
        );
      }
    } catch (responsesError: any) {
      this.logger.warn(
        `DeepSeek Responses API call failed (${responsesError?.message}). Falling back to standard Chat Completions.`,
      );

      // 2. Fallback a Chat Completions API estándar
      const isReasoningModel = /reasoner/i.test(modelToUse);
      const chatBody: any = {
        model: modelToUse,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userInput },
        ],
      };

      if (!isReasoningModel) {
        chatBody.temperature = 0.2;
      }

      const chatResponse = await client.chat.completions.create(chatBody);
      raw = this.getChatCompletionContent(chatResponse).trim();

      const usage = chatResponse?.usage;
      if (usage?.prompt_tokens_details?.cached_tokens) {
        this.logger.debug(
          `[DeepSeek Cache] Read ${usage.prompt_tokens_details.cached_tokens} cached tokens via chat completions`,
        );
      }
    }

    if (!raw) {
      throw new Error(
        `El modelo DeepSeek (${modelToUse}) devolvió una respuesta vacía.`,
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
      'Eres un asistente generador de prompts para mejorar la creacion de estos a partir de un objetivo dado. Devuelve solo el prompt generado sin ningun tipo de explicacion alguna ni texto adicioinal';
    const userInput = `Objetivo del usuario: "${goal}"`;

    let generatedText = '';

    try {
      const response: any = await client.responses.create({
        model: modelToUse,
        instructions: systemPrompt,
        input: userInput,
      });

      generatedText = response?.output_text?.trim() || '';
    } catch (error: any) {
      this.logger.warn(
        `DeepSeek Responses API failed for generatePrompt (${error?.message}). Falling back to Chat Completions.`,
      );

      const isReasoningModel = /reasoner/i.test(modelToUse);
      const chatBody: any = {
        model: modelToUse,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userInput },
        ],
      };

      if (!isReasoningModel) {
        chatBody.temperature = 0.2;
      }

      const response = await client.chat.completions.create(chatBody);
      generatedText = this.getChatCompletionContent(response).trim();
    }

    return {
      prompt: generatedText,
    };
  }

  private getChatCompletionContent(response: any): string {
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
