export class JsonSanitizerUtil {
  static sanitizeJsonResponse(payload: string): string {
    if (!payload || typeof payload !== 'string') return '';

    // Remove BOM and other invisible characters
    let cleaned = payload.replace(/^\uFEFF/, '').trim();
    if (!cleaned) return '';

    // Strip code fences if present
    cleaned = this.stripCodeFences(cleaned);

    // Remove any leading/trailing text that's not part of JSON
    // Look for the first { or [ and last } or ]
    const indexOfBrace = cleaned.indexOf('{');
    const indexOfBracket = cleaned.indexOf('[');

    let firstBrace = Infinity;
    if (indexOfBrace >= 0) firstBrace = Math.min(firstBrace, indexOfBrace);
    if (indexOfBracket >= 0) firstBrace = Math.min(firstBrace, indexOfBracket);

    const lastBrace = Math.max(
      cleaned.lastIndexOf('}'),
      cleaned.lastIndexOf(']')
    );

    if (firstBrace !== Infinity && lastBrace !== -1 && firstBrace < lastBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }

    // Fix JavaScript object notation (unquoted keys) to valid JSON
    cleaned = this.fixJavaScriptObjectNotation(cleaned);

    // Remove trailing commas before closing braces/brackets
    cleaned = this.removeTrailingCommas(cleaned);

    return cleaned.trim();
  }

  static removeTrailingCommas(payload: string): string {
    if (!payload) return payload;
    // Remove trailing commas in objects: , } -> } and in arrays: , ] -> ]
    return payload.replace(/,\s*([}\]])/g, '$1');
  }

  static fixJavaScriptObjectNotation(payload: string): string {
    try {
      JSON.parse(payload);
      return payload; // Already valid JSON
    } catch {
      // Not valid JSON, try to fix unquoted keys: {key: or ,key: or [key: -> {"key":
      return payload.replace(
        /([{,\[])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g,
        '$1"$2":'
      );
    }
  }

  static stripCodeFences(payload: string): string {
    if (!payload) return '';
    let cleaned = payload.trim();
    // Check for markdown code blocks anywhere
    const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (match && match[1]) {
      return match[1].trim();
    }
    if (cleaned.startsWith('```')) {
      const lines = cleaned.split('\n');
      lines.shift();
      if (lines[lines.length - 1]?.trim() === '```') {
        lines.pop();
      }
      return lines.join('\n').trim();
    }
    return cleaned;
  }

  static sanitizeUnescapedControlChars(payload: string): string {
    // Replace unescaped newlines/tabs inside JSON string literals
    let inString = false;
    let escaped = false;
    let result = '';

    for (let i = 0; i < payload.length; i++) {
      const char = payload[i];

      if (escaped) {
        result += char;
        escaped = false;
        continue;
      }

      if (char === '\\') {
        result += char;
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        result += char;
        continue;
      }

      if (inString) {
        if (char === '\n') {
          result += '\\n';
        } else if (char === '\r') {
          result += '\\r';
        } else if (char === '\t') {
          result += '\\t';
        } else {
          result += char;
        }
      } else {
        result += char;
      }
    }

    return result;
  }

  static parsePossiblyChunkedJson(payload: string): any {
    const trimmed = (payload || '').trim();
    if (!trimmed) {
      throw new Error(
        'Respuesta JSON vacía recibida del modelo de IA (0 caracteres). Verifique si el modelo agotó el límite de tokens o si la respuesta no contuvo texto.',
      );
    }

    // 1. Intento directo
    let direct = this.tryParseJson(trimmed);
    if (direct.success) return direct.value;

    // 2. Intento con limpieza de trailing commas
    const withoutTrailingCommas = this.removeTrailingCommas(trimmed);
    direct = this.tryParseJson(withoutTrailingCommas);
    if (direct.success) return direct.value;

    // 3. Intento con sanitización de caracteres de control dentro de strings
    const sanitizedControls = this.sanitizeUnescapedControlChars(withoutTrailingCommas);
    direct = this.tryParseJson(sanitizedControls);
    if (direct.success) return direct.value;

    // 4. Intento extrayendo fragmentos estructurados balanceados
    const chunkValues = this.extractJsonChunks(trimmed);
    if (chunkValues.length === 1) return chunkValues[0];
    if (chunkValues.length > 1) return chunkValues;

    // 5. Intento extrayendo fragmentos del texto con caracteres de control sanitizados
    const chunkValuesSanitized = this.extractJsonChunks(sanitizedControls);
    if (chunkValuesSanitized.length === 1) return chunkValuesSanitized[0];
    if (chunkValuesSanitized.length > 1) return chunkValuesSanitized;

    throw new Error(
      `Error al parsear la respuesta JSON: ${direct.error}\nRespuesta recibida: ${payload}`,
    );
  }

  static extractJsonChunks(payload: string): any[] {
    const trimmed = (payload || '').trim();
    if (!trimmed) return [];

    const results: any[] = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < trimmed.length; i++) {
      const char = trimmed[i];

      if (depth === 0) {
        if (/\s/.test(char)) continue;

        if (char === '{' || char === '[') {
          current = char;
          depth = 1;
          inString = false;
          escapeNext = false;
          continue;
        }
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
          const chunkStr = current.trim();
          let parsed = this.tryParseJson(chunkStr);
          if (!parsed.success) {
            parsed = this.tryParseJson(this.removeTrailingCommas(chunkStr));
          }
          if (!parsed.success) {
            parsed = this.tryParseJson(
              this.sanitizeUnescapedControlChars(this.removeTrailingCommas(chunkStr)),
            );
          }

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

  static tryParseJson(input: string): { success: boolean; value?: any; error?: string } {
    try {
      return { success: true, value: JSON.parse(input) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
}
