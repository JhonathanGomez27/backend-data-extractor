import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { TelegramService } from 'src/telegram/telegram.service';

@Injectable()
export class OpenaiService {
  private client: OpenAI;

  private readonly contextModel = 'gpt-4.1';
  private readonly summaryModel = 'gpt-4.1-mini';
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
  `;

  private GENERATE_TEMPLATE_PROMPT = `
    Eres un asistente generador de prompts para mejorar la creacion de estos a partir de un objetivo dado. Devuelve solo el prompt generado sin ningun tipo de explicacion alguna ni texto adicioinal
  `;

  constructor(
    private config: ConfigService,
    private telegramService: TelegramService,
  ) {
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
      response_format: { type: 'json_object' },
    });

    const raw = this.getCompletionContent(response);

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
    } catch (error: any) {
      throw new Error(
        `Error al parsear la respuesta de OpenAI: ${error.message}\nRespuesta recibida: ${raw}`,
      );
    }
  }

  async generateSummary(
    transcripcion: any,
    templates: any,
    config_global?: Record<string, any>,
  ): Promise<any> {
    const userPayload = {
      templates,
      transcripcion,
      config_global: config_global || {},
    };

    const response = await this.client.chat.completions.create({
      model: this.summaryModel,
      messages: [
        { role: 'system', content: this.SUMMARY_SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(userPayload) },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    const raw = this.getCompletionContent(response);

    // Intentar parsear la respuesta como JSON
    try {
      const parsed = JSON.parse(raw);

      // Validar que el JSON tenga la estructura esperada
      return parsed;
    } catch (error : any) {
      throw new Error(
        `Error al parsear la respuesta de OpenAI: ${error.message}\nRespuesta recibida: ${raw}`,
      );
    }
  }

  async generatePromt(goal: string): Promise<{ prompt: string }> {
    const userPrompt = `Objetivo del usuario: "${goal}"`;

    const response = await this.client.chat.completions.create({
      model: this.contextModel,
      messages: [
        { role: 'system', content: this.GENERATE_TEMPLATE_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
    });

    return {
      prompt: this.getCompletionContent(response),
    };
  }

  async generateExtraction(prompt: string, transcripcion: any, model_prompt: string = '', audio?: string): Promise<{ response: any }> {

    const userPrompt = `Aplica el siguiente prompt al siguiente texto de transcripción y elimina cualquier texto que este antes o despues de la estructura json\n\nPrompt: ${prompt}\nTranscripción: ${JSON.stringify(transcripcion)}`;

    const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
    // if (model_prompt?.trim()) {
    //   messages.push({ role: 'system', content: model_prompt });
    // }
    messages.push({ role: 'user', content: userPrompt });

    const response = await this.client.chat.completions.create({
      model: this.summaryModel,
      messages,
      temperature: 0.2,
    });

    const raw = this.getCompletionContent(response).trim();

    // Log raw response for debugging (first 500 chars)
    console.log(`[OpenAI] Raw response preview for ${model_prompt}: `, raw.substring(0, 500));

    // Sanitize the response
    const sanitized = this.sanitizeJsonResponse(raw);

    // Log sanitized response for debugging (first 500 chars)
    console.log(`[OpenAI] Sanitized response preview for ${model_prompt}: `, sanitized.substring(0, 500));

    try {
      const parsed = this.parsePossiblyChunkedJson(sanitized);
      return { response: parsed };
    } catch (error: any) {
      // Enhanced error with more context
      console.error(`[OpenAI] Failed to parse response for ${model_prompt}. Raw response:`, raw);
      
      // Enviar alerta a Telegram por error de parseo
      await this.telegramService.sendTelegramAlert({
        title: 'Error al Parsear Respuesta OpenAI',
        message: `Fallo en generateExtraction para el audio: ${audio || 'sin nombre'}`,
        error,
        extra: {
          modelPrompt: model_prompt,
          rawResponseLength: raw.length,
          sanitizedResponseLength: sanitized.length,
          first200Chars: sanitized.substring(0, 200),
          promptPreview: prompt.substring(0, 200),
        },
        level: 'ERROR',
      });
      
      throw new Error(
        `Error al parsear la respuesta de OpenAI: ${error.message}\n` +
        `Raw response length: ${raw.length}\n` +
        `Sanitized response length: ${sanitized.length}\n` +
        `First 200 chars of sanitized: ${sanitized.substring(0, 200)}`
      );
    }
  }

  private sanitizeJsonResponse(payload: string): string {
    if (!payload) return payload;

    // Remove BOM and other invisible characters
    let cleaned = payload.replace(/^\uFEFF/, '').trim();

    // Strip code fences if present
    cleaned = this.stripCodeFences(cleaned);

    // Remove any leading/trailing text that's not part of JSON
    // Look for the first { or [ and last } or ]
    const indexOfBrace = cleaned.indexOf('{');
    const indexOfBracket = cleaned.indexOf('[');

    // Find the FIRST opening character (Math.min, not Math.max!)
    let firstBrace = Infinity;
    if (indexOfBrace >= 0) firstBrace = Math.min(firstBrace, indexOfBrace);
    if (indexOfBracket >= 0) firstBrace = Math.min(firstBrace, indexOfBracket);

    const lastBrace = Math.max(
      cleaned.lastIndexOf('}'),
      cleaned.lastIndexOf(']')
    );

    if (firstBrace !== Infinity && firstBrace < lastBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }

    // Fix JavaScript object notation (unquoted keys) to valid JSON
    cleaned = this.fixJavaScriptObjectNotation(cleaned);

    return cleaned.trim();
  }

  /**
   * Converts JavaScript object notation with unquoted keys to valid JSON
   * Example: {code: "value"} -> {"code": "value"}
   */
  private fixJavaScriptObjectNotation(payload: string): string {
    try {
      // Try to parse as-is first
      JSON.parse(payload);
      return payload; // Already valid JSON
    } catch (e) {
      // Not valid JSON, try to fix unquoted keys
      // This regex finds unquoted keys like: {key: or ,key: or [key:
      // and replaces them with quoted versions: {"key": or ,"key": or ["key":
      const fixed = payload.replace(
        /([{,\[])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g,
        '$1"$2":'
      );

      return fixed;
    }
  }

  private stripCodeFences(payload: string): string {
    if (!payload.startsWith('```')) return payload;
    const lines = payload.split('\n');
    // remove opening fence and optional language tag
    lines.shift();
    // remove closing fence if present
    if (lines[lines.length - 1].trim() === '```') {
      lines.pop();
    }
    return lines.join('\n').trim();
  }

  private parsePossiblyChunkedJson(payload: string): any {
    const direct = this.tryParseJson(payload);
    if (direct.success) return direct.value;

    const chunkValues = this.extractJsonChunks(payload);
    if (chunkValues.length === 1) return chunkValues[0];
    if (chunkValues.length > 1) return chunkValues;

    throw new Error(
      `Error al parsear la respuesta de OpenAI: ${direct.error}\nRespuesta recibida: ${payload}`,
    );
  }

  private extractJsonChunks(payload: string): any[] {
    const trimmed = payload.trim();
    if (!trimmed) return [];

    const results: any[] = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < trimmed.length; i++) {
      const char = trimmed[i];

      if (depth === 0) {
        if (/\s/.test(char)) {
          continue;
        }

        if (char === '{' || char === '[') {
          current = char;
          depth = 1;
          inString = false;
          escapeNext = false;
          continue;
        }

        // ignorar cualquier basura fuera de JSON
        continue;
      }

      current += char;

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\' && inString) {
        escapeNext = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (char === '{' || char === '[') {
        depth++;
      } else if (char === '}' || char === ']') {
        depth--;

        if (depth === 0) {
          const parsed = this.tryParseJson(current.trim());
          if (parsed.success) {
            results.push(parsed.value);
          } else {
            throw new Error(parsed.error ?? 'No se pudo parsear un fragmento JSON');
          }
          current = '';
        }
      }
    }

    return results;
  }

  private tryParseJson(input: string): { success: boolean; value?: any; error?: string } {
    try {
      return { success: true, value: JSON.parse(input) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
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
