import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiExtractionParams,
  AiExtractionResult,
  AiProviderInfo,
  AiProviderInterface,
  AiProviderType,
} from './ai.interfaces';
import { OpenaiProvider } from './providers/openai.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { ClaudeProvider } from './providers/claude.provider';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly providers: Map<AiProviderType, AiProviderInterface> = new Map();
  private readonly defaultProviderType: AiProviderType;

  constructor(
    private config: ConfigService,
    private openaiProvider: OpenaiProvider,
    private geminiProvider: GeminiProvider,
    private claudeProvider: ClaudeProvider,
  ) {
    this.providers.set('openai', this.openaiProvider);
    this.providers.set('gemini', this.geminiProvider);
    this.providers.set('claude', this.claudeProvider);

    const configuredDefault = this.config.get<string>('ai.defaultProvider');
    this.defaultProviderType = (
      configuredDefault === 'gemini' || configuredDefault === 'claude'
        ? configuredDefault
        : 'openai'
    ) as AiProviderType;

    this.logger.log(
      `AiService initialized. Default provider: ${this.defaultProviderType}. Configured providers: ${this.getConfiguredProviderNames().join(', ')}`,
    );
  }

  getProvider(providerType?: AiProviderType): AiProviderInterface {
    const targetType = providerType || this.defaultProviderType;
    const provider = this.providers.get(targetType);

    if (!provider) {
      this.logger.warn(
        `Provider "${targetType}" not found. Falling back to default provider "${this.defaultProviderType}"`,
      );
      return (
        this.providers.get(this.defaultProviderType) || this.openaiProvider
      );
    }

    return provider;
  }

  async generateExtraction(
    params: AiExtractionParams,
    providerType?: AiProviderType,
    specificModel?: string,
  ): Promise<AiExtractionResult> {
    const provider = this.getProvider(providerType);
    const extractionParams: AiExtractionParams = {
      ...params,
      specificModel: specificModel || params.specificModel,
    };

    this.logger.log(
      `Routing extraction to provider: ${provider.providerType} (model: ${extractionParams.specificModel || provider.getDefaultModel()})`,
    );

    return provider.generateExtraction(extractionParams);
  }

  async generatePrompt(
    goal: string,
    providerType?: AiProviderType,
    specificModel?: string,
  ): Promise<{ prompt: string }> {
    const provider = this.getProvider(providerType);
    if (provider.generatePrompt) {
      return provider.generatePrompt(goal, specificModel);
    }
    return this.openaiProvider.generatePrompt(goal, specificModel);
  }

  getProvidersInfo(): AiProviderInfo[] {
    return [
      {
        id: 'openai',
        name: 'OpenAI',
        isConfigured: this.openaiProvider.isAvailable(),
        defaultModel: this.openaiProvider.getDefaultModel(),
        availableModels: this.openaiProvider.getAvailableModels(),
      },
      {
        id: 'gemini',
        name: 'Google Gemini',
        isConfigured: this.geminiProvider.isAvailable(),
        defaultModel: this.geminiProvider.getDefaultModel(),
        availableModels: this.geminiProvider.getAvailableModels(),
      },
      {
        id: 'claude',
        name: 'Anthropic Claude',
        isConfigured: this.claudeProvider.isAvailable(),
        defaultModel: this.claudeProvider.getDefaultModel(),
        availableModels: this.claudeProvider.getAvailableModels(),
      },
    ];
  }

  private getConfiguredProviderNames(): string[] {
    const names: string[] = [];
    if (this.openaiProvider.isAvailable()) names.push('openai');
    if (this.geminiProvider.isAvailable()) names.push('gemini');
    if (this.claudeProvider.isAvailable()) names.push('claude');
    return names;
  }
}
