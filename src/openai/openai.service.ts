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

  private SUMMARY_SYSTEM_PROMPT = `
    Eres un analista conversacional. Debes aplicar los MÓDULOS indicados en una PLANTILLA DE ANÁLISIS al contenido de una TRANSCRIPCIÓN y devolver EXCLUSIVAMENTE un JSON VÁLIDO.

    REQUISITOS GENERALES
    - Idioma de salida: español.
    - Sé operativo y conciso; justifica cada hallazgo con evidencias (texto y tiempo).
    - Usa marcas de tiempo en segundos (float, con 2 decimales).
    - No inventes datos; si algo no se detecta, devuelve resultado vacío y un motivo.
    - En campos de PII (DNI, IBAN, email) **enmascara** salvo 4 últimos caracteres: “ES61 2100 **** **** … 439X”.
    - Si hay "aggregated_polarity", úsalo para “sentiment.global” y, si es posible, estima “client”/“agent”.

    MÓDULOS Y EXPECTATIVAS DE SALIDA
    - ENTIDADES:
      - Usa "config.extraer", "config.tipos", "config.reglas".
      - Devuelve: "items" (tipo, valor_normalizado, evidencia.texto, evidencia.momento, coincidencia.modo, confianza).
      - Si "debe_mencionarse=true" y no aparece en la "ventana_inicial_segundos", marca "alerta" con motivo.

    - CONSENTIMIENTO:
      - Busca explícito/implícito según "frases_clave" y reglas.
      - Devuelve: "explicito" (frases, momentos), "implicito" (frases, momentos), "veredicto" y "observaciones".

    - INTENCIONES:
      - Respeta "clasificacion_intencion" y reglas de ventana/hablante si existen.
      - Devuelve lista con { hablante, intencion, momento, texto }.

    - EMOCIONES:
      - Si está activo, clasifica por hablante en {positivo|neutral|negativo}; incluye recuentos y ejemplos con momento.

    - SENTIMENT:
      - Estructura obligatoria:
        "sentiment":{
          "global":{"score_tag","agreement","subjectivity","irony"},
          "client":{"score_tag","agreement","subjectivity","irony"},
          "agent":{"score_tag","agreement","subjectivity","irony"}
        }
      - Valores válidos: score_tag ∈ {P+,P,NEU,N,N+,NONE}, agreement ∈ {AGREEMENT,DISAGREEMENT}, subjectivity ∈ {OBJECTIVE,SUBJECTIVE}, irony ∈ {NONIRONIC,IRONIC}.
      - Si no puedes estimar client/agent, usa "NONE" y explica en "meta.notas".

    - COMPLIANCE:
      - Verifica "frases_obligatorias"; devuelve presentes/ausentes, momentos y "cumplimiento" {Completo|Parcial|NoCumple}.

    FORMATO DE SALIDA (JSON ÚNICO)
    {
      "resumen_general": { ... },
      "estructura_conversacion": { ... },
      "por_hablante": { ... },                 // solo si se solicita en la plantilla
      "entidades": { ... },                    // si el módulo está en la plantilla
      "consentimiento": { ... },               // si el módulo está en la plantilla
      "intenciones": { ... },                  // si el módulo está en la plantilla
      "emociones": { ... },                    // si el módulo está en la plantilla
      "sentiment": { ... },                    // si el módulo está en la plantilla
      "compliance": { ... },                   // si el módulo está en la plantilla
      "metricas": { ... },                     // si se solicita
      "meta": { "notas": [ ... ] }             // opcional, diagnóstico del proceso
    }

    REGLAS FINALES
    - Devuelve SOLO el JSON. Sin texto extra.
    - No incluyas campos de módulos no solicitados en la plantilla.
    - Los arrays deben existir aunque estén vacíos.
  `

  private GENERATE_TEMPLATE_PROMPT = `
    Eres un asistente generador de prompts para mejorar la creacion de estos a partir de un objetivo dado.
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

  async generateSummary(transcripcion: any, templates: any, config_global?: Record<string, any>): Promise<any> {

    const userPayload = {
      templates,
      transcripcion,
      config_global: config_global || {},
    }

    const response = await this.client.chat.completions.create({
      model: this.summaryModel,
      messages: [
        { role: 'system', content: this.SUMMARY_SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(userPayload) },
      ],
      temperature: 0.2,
    });

    const raw = response.choices[0].message?.content || '';

    // Intentar parsear la respuesta como JSON
    try {
      const parsed = JSON.parse(raw);

      // Validar que el JSON tenga la estructura esperada
      return parsed;
    } catch (error) {
      throw new Error(
        `Error al parsear la respuesta de OpenAI: ${error.message}\nRespuesta recibida: ${raw}`,
      );
    }
  }

  async generatePromt(goal: string): Promise<string> {
    const userPrompt = `Objetivo del usuario: "${goal}"`;

    const response = await this.client.chat.completions.create({
      model: this.contextModel,
      messages: [
        { role: 'system', content: this.GENERATE_TEMPLATE_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
    });

    return response.choices[0].message?.content || '';
  }

}
