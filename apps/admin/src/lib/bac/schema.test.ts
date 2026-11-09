import { describe, expect, it } from 'vitest';
import { bacGradeSchema, bacStyleSchema, bacTextFormat } from './schema';

const long = 'x'.repeat(400);

describe('bacTextFormat (what is sent to OpenAI)', () => {
  it('has no length limits in the wire JSON schema', () => {
    for (const kind of ['item', 'style'] as const) {
      expect(JSON.stringify(bacTextFormat(kind).schema), kind).not.toContain('maxLength');
    }
  });

  it('accepts over-long feedback client-side, so the handler can cut it instead of failing the paper', () => {
    expect(bacTextFormat('item').$parseRaw(JSON.stringify({ points: 1, feedback: long }))).toEqual({ points: 1, feedback: long });
    expect(bacTextFormat('style').$parseRaw(JSON.stringify({ language: 1, structure: 0, order: 2, feedback: long }))).toEqual({
      language: 1, structure: 0, order: 2, feedback: long,
    });
  });

  it('still rejects fractions and negative points', () => {
    expect(() => bacTextFormat('item').$parseRaw(JSON.stringify({ points: 1.5, feedback: '' }))).toThrow();
    expect(() => bacTextFormat('style').$parseRaw(JSON.stringify({ language: -1, structure: 0, order: 0, feedback: '' }))).toThrow();
  });
});

describe('handler schemas', () => {
  it('keep the 300-character feedback limit', () => {
    expect(bacGradeSchema.safeParse({ points: 1, feedback: long }).success).toBe(false);
    expect(bacStyleSchema.safeParse({ language: 0, structure: 0, order: 0, feedback: long }).success).toBe(false);
  });
});
