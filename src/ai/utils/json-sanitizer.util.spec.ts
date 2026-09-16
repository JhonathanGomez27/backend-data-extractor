import { JsonSanitizerUtil } from './json-sanitizer.util';

describe('JsonSanitizerUtil', () => {
  it('should throw clear error on empty or whitespace string', () => {
    expect(() => JsonSanitizerUtil.parsePossiblyChunkedJson('')).toThrow(
      /Respuesta JSON vacía recibida/,
    );
    expect(() => JsonSanitizerUtil.parsePossiblyChunkedJson('   ')).toThrow(
      /Respuesta JSON vacía recibida/,
    );
  });

  it('should parse clean JSON', () => {
    const raw = '{"name": "test", "valid": true, "count": 10}';
    const sanitized = JsonSanitizerUtil.sanitizeJsonResponse(raw);
    const result = JsonSanitizerUtil.parsePossiblyChunkedJson(sanitized);
    expect(result).toEqual({ name: 'test', valid: true, count: 10 });
  });

  it('should strip markdown code fences', () => {
    const raw = '```json\n{"status": "ok", "items": [1, 2]}\n```';
    const sanitized = JsonSanitizerUtil.sanitizeJsonResponse(raw);
    const result = JsonSanitizerUtil.parsePossiblyChunkedJson(sanitized);
    expect(result).toEqual({ status: 'ok', items: [1, 2] });
  });

  it('should fix trailing commas in objects and arrays', () => {
    const raw = '{"name": "test", "items": [1, 2, ], "extra": true, }';
    const sanitized = JsonSanitizerUtil.sanitizeJsonResponse(raw);
    const result = JsonSanitizerUtil.parsePossiblyChunkedJson(sanitized);
    expect(result).toEqual({ name: 'test', items: [1, 2], extra: true });
  });

  it('should handle unescaped control characters in string values', () => {
    const raw = '{"notes": "line 1\nline 2\ttabbed", "ok": true}';
    const sanitized = JsonSanitizerUtil.sanitizeJsonResponse(raw);
    const result = JsonSanitizerUtil.parsePossiblyChunkedJson(sanitized);
    expect(result.ok).toBe(true);
    expect(result.notes).toContain('line 1');
  });

  it('should extract JSON from surrounding text', () => {
    const raw = 'Aquí está el resultado:\n{"result": "success"}\nEspero te sirva.';
    const sanitized = JsonSanitizerUtil.sanitizeJsonResponse(raw);
    const result = JsonSanitizerUtil.parsePossiblyChunkedJson(sanitized);
    expect(result).toEqual({ result: 'success' });
  });

  it('should parse top-level JSON arrays correctly without turning them into objects', () => {
    const raw = '[{"code":"IntencionGenerica","label":"IntencionGenerica","relevance":"100"}]';
    const sanitized = JsonSanitizerUtil.sanitizeJsonResponse(raw);
    const result = JsonSanitizerUtil.parsePossiblyChunkedJson(sanitized);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([
      { code: 'IntencionGenerica', label: 'IntencionGenerica', relevance: '100' },
    ]);
  });
});
