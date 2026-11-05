import { zodTextFormat } from 'openai/helpers/zod';
import { describe, expect, it } from 'vitest';
import { aiOutputSchema, normalizeAiOutput } from './schema';

const item = (over: Record<string, unknown> = {}) => ({ key: 'k', verdict: 'ok' as const, title: 'T', good: ['g'], improve: ['i'], ...over });

describe('aiOutputSchema', () => {
  it('sends no length constraints to OpenAI', () => {
    const json = JSON.stringify(zodTextFormat(aiOutputSchema, 'evaluation'));
    expect(json).not.toMatch(/maxLength|maxItems|minLength|minItems/);
  });

  it('accepts over-long values (they are truncated later, never rejected)', () => {
    expect(aiOutputSchema.safeParse({ items: [item({ title: 'x'.repeat(500) })] }).success).toBe(true);
  });
});

describe('normalizeAiOutput', () => {
  it('truncates title to 120 and entries to 400 characters (code points)', () => {
    const out = normalizeAiOutput({ items: [item({ title: 'x'.repeat(200), good: ['😀'.repeat(401)], improve: ['y'.repeat(401), 'ok'] })] });
    expect([...out.items[0]!.title]).toHaveLength(120);
    expect([...out.items[0]!.good[0]!]).toHaveLength(400);
    expect([...out.items[0]!.improve[0]!]).toHaveLength(400);
    expect(out.items[0]!.improve[1]).toBe('ok');
  });

  it('keeps at most 5 entries per list and 8 items', () => {
    const many = Array.from({ length: 9 }, (_, i) => `e${i}`);
    const out = normalizeAiOutput({ items: Array.from({ length: 10 }, (_, i) => item({ key: `k${i}`, good: many, improve: many })) });
    expect(out.items).toHaveLength(8);
    expect(out.items[0]!.good).toEqual(['e0', 'e1', 'e2', 'e3', 'e4']);
    expect(out.items[0]!.improve).toHaveLength(5);
  });

  it('leaves short values untouched', () => {
    const i = item();
    expect(normalizeAiOutput({ items: [i] })).toEqual({ items: [i] });
  });
});
