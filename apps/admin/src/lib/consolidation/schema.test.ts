import { zodTextFormat } from 'openai/helpers/zod';
import { describe, expect, it } from 'vitest';
import { aiOutputSchema, aiOutputSchemaFor, normalizeAiOutput } from './schema';

const item = (over: Record<string, unknown> = {}) => ({ key: 'k', verdict: 'ok' as const, title: 'T', good: ['g'], improve: ['i'], ...over });

describe('aiOutputSchema', () => {
  it('sends no length constraints to OpenAI', () => {
    const json = JSON.stringify(zodTextFormat(aiOutputSchema, 'evaluation'));
    expect(json).not.toMatch(/maxLength|maxItems|minLength|minItems/);
  });

  it('aiOutputSchemaFor limits the key to the expected keys, also in the schema sent to OpenAI', () => {
    const schema = aiOutputSchemaFor(['fact-0', 'fact-1']);
    expect(schema.safeParse({ items: [item({ key: 'fact-1' })] }).success).toBe(true);
    // The model once named the item after its content instead of using the expected key.
    expect(schema.safeParse({ items: [item({ key: 'asemănare_secularizare_legea_rurala' })] }).success).toBe(false);
    const json = JSON.stringify(zodTextFormat(schema, 'evaluation'));
    expect(json).toContain('"enum":["fact-0","fact-1"]');
    expect(json).not.toMatch(/maxLength|maxItems|minLength|minItems/);
  });

  it('accepts over-long values (they are truncated later, never rejected)', () => {
    expect(aiOutputSchema.safeParse({ items: [item({ title: 'x'.repeat(500) })] }).success).toBe(true);
  });
});

describe('normalizeAiOutput', () => {
  it('truncates title to 120 and entries to 400 characters (code points)', () => {
    const out = normalizeAiOutput({ items: [item({ title: 'x'.repeat(200), good: ['😀'.repeat(401)], improve: ['y'.repeat(401), 'ok'] })] }, ['k']);
    expect([...out.items[0]!.title]).toHaveLength(120);
    expect([...out.items[0]!.good[0]!]).toHaveLength(400);
    expect([...out.items[0]!.improve[0]!]).toHaveLength(400);
    expect(out.items[0]!.improve[1]).toBe('ok');
  });

  it('keeps at most 5 entries per list and 8 items', () => {
    const many = Array.from({ length: 9 }, (_, i) => `e${i}`);
    const keys = Array.from({ length: 10 }, (_, i) => `k${i}`);
    const out = normalizeAiOutput({ items: keys.map((key) => item({ key, good: many, improve: many })) }, keys);
    expect(out.items).toHaveLength(8);
    expect(out.items[0]!.good).toEqual(['e0', 'e1', 'e2', 'e3', 'e4']);
    expect(out.items[0]!.improve).toHaveLength(5);
  });

  it('writes ș and ț with the comma below in every text it keeps', () => {
    const out = normalizeAiOutput(
      { items: [item({ title: 'Ţara şi menţiunea', good: ['Ai menţionat corect şi data.'], improve: ['Adaugă ştirea.'] })] },
      ['k'],
    );
    expect(out.items[0]).toMatchObject({ title: 'Țara și mențiunea', good: ['Ai menționat corect și data.'], improve: ['Adaugă știrea.'] });
  });

  it('leaves short values untouched', () => {
    const i = item();
    expect(normalizeAiOutput({ items: [i] }, ['k'])).toEqual({ items: [i] });
  });

  it('selects the expected keys before capping, so junk never pushes out a required key', () => {
    const junk = Array.from({ length: 12 }, (_, i) => item({ key: `junk-${i}` }));
    const out = normalizeAiOutput({ items: [...junk, item({ key: 'fact-1' }), item({ key: 'fact-0' }), item({ key: 'fact-0', title: 'dup' })] }, [
      'fact-0',
      'fact-1',
    ]);
    expect(out.items.map((i) => i.key)).toEqual(['fact-0', 'fact-1']);
    expect(out.items[0]!.title).toBe('T');
  });
});
