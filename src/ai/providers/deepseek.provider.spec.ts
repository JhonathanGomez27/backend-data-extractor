import { ConfigService } from '@nestjs/config';
import { DeepseekProvider } from './deepseek.provider';

describe('DeepseekProvider', () => {
  let configService: ConfigService;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'deepseek.apiKey') return 'mock-deepseek-key';
        if (key === 'deepseek.defaultModel') return 'deepseek-chat';
        if (key === 'deepseek.baseUrl') return 'https://api.deepseek.com';
        return null;
      }),
    } as unknown as ConfigService;
  });

  it('should initialize with correct providerType and default model', () => {
    const provider = new DeepseekProvider(configService);
    expect(provider.providerType).toBe('deepseek');
    expect(provider.getDefaultModel()).toBe('deepseek-chat');
    expect(provider.getAvailableModels()).toContain('deepseek-chat');
    expect(provider.getAvailableModels()).toContain('deepseek-reasoner');
    expect(provider.isAvailable()).toBe(true);
  });

  it('should report isAvailable as false when api key is missing or placeholder', () => {
    const emptyConfig = {
      get: jest.fn(() => ''),
    } as unknown as ConfigService;
    const provider1 = new DeepseekProvider(emptyConfig);
    expect(provider1.isAvailable()).toBe(false);

    const placeholderConfig = {
      get: jest.fn(() => 'your_deepseek_api_key_here'),
    } as unknown as ConfigService;
    const provider2 = new DeepseekProvider(placeholderConfig);
    expect(provider2.isAvailable()).toBe(false);
  });

  it('should successfully extract JSON using the Responses API', async () => {
    const provider = new DeepseekProvider(configService);

    const mockResponsesCreate = jest.fn().mockResolvedValue({
      output_text: '{"resultado": "exito", "items": [1, 2, 3]}',
      usage: {
        input_tokens_details: { cached_tokens: 128 },
        output_tokens_details: { reasoning_tokens: 64 },
      },
    });

    (provider as any).client = {
      responses: {
        create: mockResponsesCreate,
      },
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    };

    const result = await provider.generateExtraction({
      prompt: 'Extrae los items',
      transcription: 'Audio transcrito',
      modelName: 'test-model',
    });

    expect(mockResponsesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'deepseek-chat',
        instructions: expect.any(String),
        input: expect.stringContaining('Audio transcrito'),
      }),
    );

    expect(result.provider).toBe('deepseek');
    expect(result.model).toBe('deepseek-chat');
    expect(result.response).toEqual({ resultado: 'exito', items: [1, 2, 3] });
  });

  it('should fallback to chat.completions when responses.create fails', async () => {
    const provider = new DeepseekProvider(configService);

    const mockResponsesCreate = jest.fn().mockRejectedValue(new Error('Responses API endpoint not found'));
    const mockChatCompletionsCreate = jest.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: '{"fallback": true}',
          },
        },
      ],
      usage: {
        prompt_tokens_details: { cached_tokens: 50 },
      },
    });

    (provider as any).client = {
      responses: {
        create: mockResponsesCreate,
      },
      chat: {
        completions: {
          create: mockChatCompletionsCreate,
        },
      },
    };

    const result = await provider.generateExtraction({
      prompt: 'Extrae con fallback',
      transcription: 'Texto de prueba',
    });

    expect(mockResponsesCreate).toHaveBeenCalled();
    expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'deepseek-chat',
        messages: expect.any(Array),
      }),
    );
    expect(result.response).toEqual({ fallback: true });
  });
});
