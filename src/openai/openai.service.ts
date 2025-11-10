import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

const OUTPUT_SCHEMA = {
  description: 'string',
  template: {
    templateName: 'string',
    modules: [
      {
        key: 'string',
        enabled: 'boolean',
        config: 'object',
      },
    ],
  },
};

@Injectable()
export class OpenaiService {
  private client: OpenAI;

  private readonly contextModel = 'gpt-4.1';
  private readonly summaryModel = 'gpt-3.5-turbo';
  private readonly contextLimit = 1_000_000; // tokens

  private TEMPLATE_SYSTEM_PROMPT = `
          Eres un generador de plantillas de análisis conversacional para una aplicación de IA. 
          Debes producir:
          1) "description": una reformulación breve, clara y operacional del objetivo solicitado por el usuario.
          2) "template": un objeto JSON compatible con una plantilla modular de análisis. 
            La estructura esperada es:
            {
              "templateName": string,
              "modules": [
                { "key": string, "enabled": boolean, "config": object }
              ]
            }
    
          Reglas:
          - Responde EXCLUSIVAMENTE en JSON válido UTF-8 sin texto adicional.
          - No inventes datos de negocio: convierte la intención en reglas y parámetros verificables.
          - Si la intención está centrada en detectar entidades (ej., marca/empresa/producto), usa el módulo "entidades".
          - Si la intención es una validación de mención en cierto tramo (ej., al inicio), añade reglas de ventana temporal (segundos) en la config del módulo.
          - Si la intención es un chequeo binario (sí/no), retorna módulos mínimos necesarios.
          - Mantén "key" con nombres existentes: "sentiment", "emociones", "consentimiento", "entidades", etc.
          - Para "entidades", el campo config debe incluir, como mínimo:
            {
              "extraer": true,
              "tipos": [...],
              "reglas": {
                "debe_mencionarse": boolean,
                "ventana_inicial_segundos": number,
                "coincidencia": { "modo": "exacta|parcial|lemmatizada", "case_sensitive": boolean },
                "sinonimos": string[]
              }
            }
          - Usa valores por defecto sensatos si el usuario no los provee.
          - "templateName" debe ser corto y descriptivo del objetivo.
    `;

  constructor(private config: ConfigService) {
    this.client = new OpenAI({
      apiKey: this.config.get<string>('openai.apiKey'),
    });
  }

  async generateTemplates(
    goal: string,
    context?: Record<string, any>,
  ): Promise<any> {
    const userPrompt = `Objetivo del usuario: "${goal}"\nContexto opcional (JSON): ${JSON.stringify(context ?? null)}`;

    const response = await this.client.chat.completions.create({
      model: this.contextModel,
      messages: [
        { role: 'system', content: this.TEMPLATE_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
    });

    const raw = response.choices[0].message?.content || '';

    // Intentar parsear la respuesta como JSON
    try {
      const parsed = JSON.parse(raw);

      // Validar que el JSON tenga la estructura esperada
      if (
        typeof parsed.description === 'string' &&
        typeof parsed.template === 'object'
      ) {
        return parsed;
      } else {
        throw new Error('La respuesta JSON no tiene la estructura esperada.');
      }
    } catch (error) {
      throw new Error(
        `Error al parsear la respuesta de OpenAI: ${error.message}\nRespuesta recibida: ${raw}`,
      );
    }
  }
}
