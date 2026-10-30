import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { corsHeaders } from './cors';
import { handleEvaluate, type Deps } from './handler';

const PUBLISHED = '11111111-1111-4111-8111-111111111111';
const DRAFT = '22222222-2222-4222-8222-222222222222';
const UNKNOWN = '33333333-3333-4333-8333-333333333333';

const exercises: Record<string, unknown> = {
  [PUBLISHED]: { prompt: 'P', criteria: 'C', lessons: { status: 'published' } },
  [DRAFT]: { prompt: 'P', criteria: 'C', lessons: { status: 'draft' } },
};
const settings = { rules: 'reguli', grade_min: 1, grade_max: 10, model: 'gpt-5-mini' };

function fakeDb(): SupabaseClient {
  return {
    from(table: string) {
      let id: unknown;
      const b = {
        select: () => b,
        eq: (_c: string, v: unknown) => ((id = v), b),
        maybeSingle: async () => ({ data: exercises[id as string] ?? null, error: null }),
        single: async () => ({ data: table === 'ai_settings' ? settings : null, error: null }),
      };
      return b;
    },
  } as unknown as SupabaseClient;
}

function deps(over: Partial<Deps> = {}): Deps {
  return {
    db: fakeDb(),
    evaluate: vi.fn(async () => ({ grade: 7, summary: 'Bine.', suggestions: ['Adaugă date.'] })),
    rateLimit: vi.fn(async () => true),
    ...over,
  };
}

const ok = (text = 'Un text.') => ({ exerciseId: PUBLISHED, text });
const gradeOf = (r: { json: unknown }) => (r.json as { grade: number }).grade;

describe('handleEvaluate', () => {
  it('returns the evaluation for a valid request', async () => {
    const d = deps();
    const r = await handleEvaluate(ok(), '1.2.3.4', d);
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ grade: 7, gradeMin: 1, gradeMax: 10, summary: 'Bine.', suggestions: ['Adaugă date.'] });
    expect(d.rateLimit).toHaveBeenCalledWith('evaluate:1.2.3.4');
    expect(d.evaluate).toHaveBeenCalledWith(expect.objectContaining({ model: 'gpt-5-mini' }));
  });

  it('clamps and rounds the grade', async () => {
    const mk = (grade: number) => deps({ evaluate: async () => ({ grade, summary: 's', suggestions: [] }) });
    expect(gradeOf(await handleEvaluate(ok(), 'ip', mk(14)))).toBe(10);
    expect(gradeOf(await handleEvaluate(ok(), 'ip', mk(7.6)))).toBe(8);
    expect(gradeOf(await handleEvaluate(ok(), 'ip', mk(-3)))).toBe(1);
  });

  it('counts code points, not bytes or UTF-16 units', async () => {
    const text = 'șțăîâ'.repeat(600);
    expect([...text].length).toBe(3000);
    expect((await handleEvaluate(ok(text), 'ip', deps())).status).toBe(200);
    const r = await handleEvaluate(ok(text + 'ț'), 'ip', deps());
    expect(r.status).toBe(400);
    expect(r.json).toMatchObject({ error: 'too_long', message: 'Textul depășește 3000 de caractere.' });
    expect((await handleEvaluate(ok('😀'.repeat(3000)), 'ip', deps())).status).toBe(200);
  });

  it('rejects whitespace-only text as empty', async () => {
    const r = await handleEvaluate(ok('  \n\t '), 'ip', deps());
    expect(r.status).toBe(400);
    expect(r.json).toMatchObject({ error: 'empty', message: 'Scrie un text înainte de a-l trimite.' });
  });

  it('rejects malformed bodies', async () => {
    const bodies = [null, 'x', 42, {}, { exerciseId: PUBLISHED }, { exerciseId: 1, text: 'a' }, { exerciseId: PUBLISHED, text: 5 }];
    for (const body of bodies) {
      const r = await handleEvaluate(body, 'ip', deps());
      expect(r.status).toBe(400);
      expect(r.json).toMatchObject({ error: 'bad_request' });
    }
  });

  it('returns 404 for a non-uuid id, unknown exercise or unpublished lesson', async () => {
    for (const id of ['nope', UNKNOWN, DRAFT]) {
      const d = deps();
      const r = await handleEvaluate({ exerciseId: id, text: 'a' }, 'ip', d);
      expect(r.status).toBe(404);
      expect(r.json).toMatchObject({ error: 'not_found' });
      expect(d.rateLimit).not.toHaveBeenCalled();
    }
  });

  it('returns 429 without calling the evaluator when rate limited', async () => {
    const d = deps({ rateLimit: async () => false });
    const r = await handleEvaluate(ok(), 'ip', d);
    expect(r.status).toBe(429);
    expect(r.json).toMatchObject({
      error: 'rate_limited',
      message: 'Ai atins limita de evaluări pentru moment. Încearcă din nou peste o oră.',
    });
    expect(d.evaluate).not.toHaveBeenCalled();
  });

  it('does not consume quota for invalid requests', async () => {
    const d = deps();
    await handleEvaluate(ok('   '), 'ip', d);
    expect(d.rateLimit).not.toHaveBeenCalled();
  });

  it('returns 502 ai_failed when the evaluator throws or returns junk, without leaking internals', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const cases: Deps['evaluate'][] = [
      async () => {
        throw new Error('secret sk-123 stack');
      },
      async () => ({ grade: 'x' }),
      async () => null,
    ];
    for (const evaluate of cases) {
      const r = await handleEvaluate(ok(), 'ip', deps({ evaluate }));
      expect(r.status).toBe(502);
      expect(r.json).toEqual({ error: 'ai_failed', message: 'Evaluarea nu a reușit. Încearcă din nou.' });
    }
  });

  it('returns 502 when the rate limit check itself fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const rateLimit = async () => {
      throw new Error('db down');
    };
    const r = await handleEvaluate(ok(), 'ip', deps({ rateLimit }));
    expect(r.status).toBe(502);
  });
});

describe('corsHeaders', () => {
  const allowed = ['http://localhost:8081', 'https://prepio.example'];
  it('echoes an allowed origin', () => {
    const h = corsHeaders('http://localhost:8081', allowed);
    expect(h['Access-Control-Allow-Origin']).toBe('http://localhost:8081');
    expect(h['Access-Control-Allow-Methods']).toBe('POST, OPTIONS');
    expect(h['Access-Control-Allow-Headers']).toBe('Content-Type');
    expect(h.Vary).toContain('Origin');
  });
  it('gives no ACAO header to other origins or when absent', () => {
    expect(corsHeaders('https://evil.example', allowed)['Access-Control-Allow-Origin']).toBeUndefined();
    expect(corsHeaders(null, allowed)['Access-Control-Allow-Origin']).toBeUndefined();
  });
});
