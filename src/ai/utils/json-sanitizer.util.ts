export class JsonSanitizerUtil {
  static sanitizeJsonResponse(payload: string): string {
    if (!payload) return payload;

    // Remove BOM and other invisible characters
    let cleaned = payload.replace(/^\uFEFF/, '').trim();

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

    if (firstBrace !== Infinity && firstBrace < lastBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }

    // Fix JavaScript object notation (unquoted keys) to valid JSON
    cleaned = this.fixJavaScriptObjectNotation(cleaned);

    return cleaned.trim();
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
    if (!payload.startsWith('```')) return payload;
    const lines = payload.split('\n');
    lines.shift();
    if (lines[lines.length - 1]?.trim() === '```') {
      lines.pop();
    }
    return lines.join('\n').trim();
  }

  static parsePossiblyChunkedJson(payload: string): any {
    const direct = this.tryParseJson(payload);
    if (direct.success) return direct.value;

    const chunkValues = this.extractJsonChunks(payload);
    if (chunkValues.length === 1) return chunkValues[0];
    if (chunkValues.length > 1) return chunkValues;

    throw new Error(
      `Error al parsear la respuesta JSON: ${direct.error}\nRespuesta recibida: ${payload}`
    );
  }

  static extractJsonChunks(payload: string): any[] {
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

  static tryParseJson(input: string): { success: boolean; value?: any; error?: string } {
    try {
      return { success: true, value: JSON.parse(input) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
}
