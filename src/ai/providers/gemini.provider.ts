import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import {
  AiExtractionParams,
  AiExtractionResult,
  AiProviderInterface,
  AiProviderType,
} from '../ai.interfaces';
import { JsonSanitizerUtil } from '../utils/json-sanitizer.util';

@Injectable()
export class GeminiProvider implements AiProviderInterface {
  readonly providerType: AiProviderType = 'gemini';
  private readonly logger = new Logger(GeminiProvider.name);
  private client: GoogleGenAI | null = null;
  private readonly apiKey: string;
  private readonly defaultModel: string;
  private readonly availableModels = [
    'gemini-3.7-flash',
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b',
    'gemini-1.5-pro',
  ];

  constructor(private config: ConfigService) {
    this.apiKey = this.config.get<string>('gemini.apiKey') || '';
    this.defaultModel =
      this.config.get<string>('gemini.defaultModel') || 'gemini-3.7-flash';

    if (this.isAvailable()) {
      this.client = new GoogleGenAI({ apiKey: this.apiKey });
    }
  }

  isAvailable(): boolean {
    return (
      !!this.apiKey &&
      this.apiKey !== 'your_gemini_api_key_here' &&
      this.apiKey.trim().length > 0
    );
  }

  getDefaultModel(): string {
    return this.defaultModel;
  }

  getAvailableModels(): string[] {
    return this.availableModels;
  }

  private getClient(): GoogleGenAI {
    if (!this.client && this.isAvailable()) {
      this.client = new GoogleGenAI({ apiKey: this.apiKey });
    }
    if (!this.client) {
      throw new Error(
        'Gemini provider is not configured. Please set GEMINI_API_KEY in your environment.',
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
      `Generating extraction with Gemini model: ${modelToUse} for ${params.modelName || 'unnamed'}`,
    );

    const formattedTranscription =
      typeof params.transcription === 'string'
        ? params.transcription
        : JSON.stringify(params.transcription, null, 2);

    const contents = `Transcripción:\n${formattedTranscription}\n\nInstrucciones:\n${params.prompt}\n\nDevuelve exclusivamente el JSON:`;

    const isThinkingModel = /2\.5|3\.7/i.test(modelToUse);

    const config: any = {
      responseMimeType: 'application/json',
      systemInstruction:
        'Eres un extractor de información estructurada en formato JSON. Responde EXCLUSIVAMENTE con un JSON válido que cumpla las instrucciones dadas. Sin explicaciones ni texto adicional.',
    };

    if (isThinkingModel) {
      config.thinkingConfig = {
        thinkingBudget: 2048,
      };
    } else {
      config.temperature = 0.2;
    }

    let response: any;
    try {
      response = await client.models.generateContent({
        model: modelToUse,
        contents,
        config,
      });
    } catch (error: any) {
      const errMsg = error?.message || JSON.stringify(error);
      if (
        (errMsg.includes('temperature') || errMsg.includes('thinkingConfig')) &&
        ('temperature' in config || 'thinkingConfig' in config)
      ) {
        this.logger.warn(
          `Model ${modelToUse} parameter adjustment needed: ${error.message}. Retrying with minimal config.`,
        );
        delete config.temperature;
        delete config.thinkingConfig;
        response = await client.models.generateContent({
          model: modelToUse,
          contents,
          config,
        });
      } else {
        throw error;
      }
    }

    const raw = (response.text || '').trim();
    if (!raw) {
      throw new Error(
        `El modelo Gemini (${modelToUse}) devolvió una respuesta vacía.`,
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
    const contents = `Eres un asistente generador de prompts para mejorar la creacion de estos a partir de un objetivo dado. Devuelve solo el prompt generado sin ningun tipo de explicacion alguna ni texto adicional.\n\nObjetivo del usuario: "${goal}"`;

    const config: any = {
      temperature: 0.2,
    };

    let response: any;
    try {
      response = await client.models.generateContent({
        model: modelToUse,
        contents,
        config,
      });
    } catch (error: any) {
      if (
        (error?.message?.includes('temperature') ||
          JSON.stringify(error)?.includes('temperature')) &&
        'temperature' in config
      ) {
        this.logger.warn(
          `Model ${modelToUse} does not support custom temperature: ${error.message}. Retrying without temperature parameter.`,
        );
        delete config.temperature;
        response = await client.models.generateContent({
          model: modelToUse,
          contents,
          config,
        });
      } else {
        throw error;
      }
    }

    return {
      prompt: (response.text || '').trim(),
    };
  }
}
