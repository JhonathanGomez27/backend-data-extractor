export type AiProviderType = 'openai' | 'gemini' | 'claude';

export interface AiExtractionParams {
  prompt: string;
  transcription: any;
  modelName?: string;
  audioSource?: string;
  modelPrompt?: string;
  specificModel?: string;
}

export interface AiExtractionResult {
  response: any;
  rawText?: string;
  provider: AiProviderType;
  model: string;
}

export interface AiProviderInfo {
  id: AiProviderType;
  name: string;
  isConfigured: boolean;
  defaultModel: string;
  availableModels: string[];
}

export interface AiProviderInterface {
  readonly providerType: AiProviderType;
  generateExtraction(params: AiExtractionParams): Promise<AiExtractionResult>;
  generatePrompt?(goal: string, specificModel?: string): Promise<{ prompt: string }>;
  isAvailable(): boolean;
  getDefaultModel(): string;
  getAvailableModels(): string[];
}
