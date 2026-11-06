import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { handleConsolidationEvaluate, type Deps } from './handler';

const FACTS = '11111111-1111-4111-8111-111111111111';
const DRAFT = '22222222-2222-4222-8222-222222222222';
const SHORT = '33333333-3333-4333-8333-333333333333';
const VIEW = '44444444-4444-4444-8444-444444444444';
const ESSAY = '55555555-5555-4555-8555-555555555555';
const ARG = '66666666-6666-4666-8666-666666666666';
const UNKNOWN = '77777777-7777-4777-8777-777777777777';
const SRC = '88888888-8888-4888-8888-888888888888';
const NOCTX = '99999999-9999-4999-8999-999999999999';
const BLANKCTX = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DETACHED = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const BODY = 'Domnitorul a făcut reforma. Apoi a plecat în exil.';
const COMP = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const row = (id: string, type: string, content: Record<string, unknown>, status = 'published', creditCost = 1) => ({
  id, position: 0, type, prompt: 'Enunț', content, template_id: null, credit_cost: creditCost, lessons: { status },
});
const viewContent = (text: string) => ({
  count: 2,
  spans: [
    { id: 'a', sourceId: SRC, start: 0, end: 27, text, limitStart: null, limitEnd: null },
    { id: 'b', sourceId: SRC, start: 28, end: 50, text: 'Apoi a plecat în exil.', limitStart: null, limitEnd: null },
  ],
});
const exercises: Record<string, unknown> = {
  [FACTS]: row(FACTS, 'facts', { count: 2 }),
  [NOCTX]: row(NOCTX, 'facts', { count: 2 }),
  [BLANKCTX]: row(BLANKCTX, 'facts', { count: 2 }),
  [DETACHED]: row(DETACHED, 'viewpoint', viewContent('Domnitorul a făcut alt lucru')),
  [DRAFT]: row(DRAFT, 'facts', { count: 2 }, 'draft'),
  [SHORT]: row(SHORT, 'short_answer', { accepted: ['x'], mistakes: [] }),
  [ARG]: row(ARG, 'argument', {}, 'published', 2),
  [COMP]: row(COMP, 'comparison', { variant: 'similarity' }, 'published', 2),
  [VIEW]: row(VIEW, 'viewpoint', viewContent('Domnitorul a făcut reforma.')),
  [ESSAY]: row(ESSAY, 'essay', {
    requirements: [
      { id: 'r1', text: 'Cerința 1', argument: true },
      { id: 'r2', text: 'Cerința 2', argument: false },
    ],
  }),
};
const contexts: Record<string, unknown> = {
  [FACTS]: { main: 'CONTEXT-DIN-DB', requirements: {} },
  [BLANKCTX]: { main: '  ', requirements: {} },
  [DETACHED]: { main: 'Ctx', requirements: {} },
  [VIEW]: { main: 'Ctx view', requirements: {} },
  [ARG]: { main: 'Ctx arg', requirements: {} },
  [COMP]: { main: 'Ctx comp', requirements: {} },
  [ESSAY]: { main: '', requirements: { r1: 'Ctx r1', r2: 'Ctx r2' } },
};
const settings = { rules: 'reguli', model: 'gpt-5-mini' };

function fakeDb(): SupabaseClient {
  return {
    from(table: string) {
      let id: unknown;
      const rows = (): unknown => {
        if (table === 'consolidation_exercise_sources') return id === VIEW || id === DETACHED ? [{ source_id: SRC, label: 'A' }] : [];
        if (table === 'sources') return [{ id: SRC, position: 0, title: null, author: 'A', work: 'W', body: BODY }];
        return [];
      };
      const b: Record<string, unknown> = {
        select: () => b,
        eq: (_c: string, v: unknown) => ((id = v), b),
        in: () => b,
        order: () => b,
        maybeSingle: async () => ({
          data: table === 'consolidation_exercises' ? exercises[id as string] ?? null : table === 'consolidation_ai_context' ? (contexts[id as string] ? { context: contexts[id as string] } : null) : null,
          error: null,
        }),
        single: async () => ({ data: table === 'ai_settings' ? settings : null, error: null }),
        then: (res: (v: unknown) => void) => res({ data: rows(), error: null }),
      };
      return b;
    },
  } as unknown as SupabaseClient;
}

const okItems = (...keys: string[]) => ({
  items: keys.map((key) => ({ key, verdict: 'ok', title: 'T', good: ['g'], improve: [] })),
});

/** In-memory wallet: `spend` debits when the balance covers it, `refund` puts an entry's amount back once. */
function fakeCredits(balance = 10, log: string[] = []) {
  const entries = new Map<number, number>();
  let next = 1;
  return {
    get balance() {
      return balance;
    },
    spend: vi.fn(async (_userId: string, amount: number, _exerciseId: string, target: string) => {
      log.push(`spend:${amount}:${target}`);
      if (balance < amount) return { entryId: null, balance };
      balance -= amount;
      entries.set(next, amount);
      return { entryId: next++, balance };
    }),
    refund: vi.fn(async (entryId: number) => {
      log.push(`refund:${entryId}`);
      balance += entries.get(entryId) ?? 0;
      entries.delete(entryId);
      return balance;
    }),
  };
}

function deps(over: Partial<Deps> = {}): Deps {
  return {
    db: fakeDb(),
    evaluate: vi.fn(async () => okItems('fact-0', 'fact-1')),
    rateLimit: vi.fn(async () => true),
    credits: fakeCredits(),
    ...over,
  };
}

const factsReq = (over: Record<string, unknown> = {}) => ({
  exerciseId: FACTS, target: 'exercise', answer: { type: 'facts', texts: ['Primul fapt', 'Al doilea fapt'] }, ...over,
});
const code = (r: { json: unknown }) => (r.json as { error: string }).error;

describe('handleConsolidationEvaluate', () => {
  it('returns the items with ai: true, in expected order', async () => {
    const d = deps({ evaluate: vi.fn(async () => okItems('fact-1', 'fact-0')) });
    const r = await handleConsolidationEvaluate(factsReq(), 'u1', d);
    expect(r.status).toBe(200);
    expect(r.json).toEqual({
      items: [
        { key: 'fact-0', verdict: 'ok', title: 'T', good: ['g'], improve: [], ai: true },
        { key: 'fact-1', verdict: 'ok', title: 'T', good: ['g'], improve: [], ai: true },
      ],
      credits: { spent: 1, balance: 9 },
    });
    expect(d.rateLimit).toHaveBeenCalledWith('evaluate:user:u1', 30, 3600);
    expect(d.rateLimit).toHaveBeenCalledWith('evaluate:global', 300, 86400);
    expect(d.evaluate).toHaveBeenCalledWith(expect.objectContaining({ model: 'gpt-5-mini' }));
  });

  it('takes the context from the DB, ignoring extra client fields', async () => {
    const d = deps();
    await handleConsolidationEvaluate(factsReq({ context: 'CONTEXT-FALS', ai: { main: 'FALS' } }), 'u1', d);
    const { input } = vi.mocked(d.evaluate).mock.calls[0]![0];
    expect(input).toContain('CONTEXT-DIN-DB');
    expect(input).not.toContain('FALS');
  });

  it('rejects malformed bodies', async () => {
    const bodies = [
      null, 'x', {}, factsReq({ exerciseId: 1 }), factsReq({ target: 'nope' }), factsReq({ target: { requirementId: 5 } }),
      factsReq({ answer: null }), factsReq({ answer: { type: 'facts', texts: 'a' } }), factsReq({ answer: { type: 'facts', texts: ['a', 3] } }),
      factsReq({ answer: { type: 'comparison', text: 'a' } }), factsReq({ answer: { type: 'facts', texts: ['a'] } }),
    ];
    for (const body of bodies) {
      const r = await handleConsolidationEvaluate(body, 'u1', deps());
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(code(r)).toBe('bad_request');
    }
  });

  it('returns not_found for a non-AI type, unknown id, non-uuid id or unpublished lesson, without consuming quota', async () => {
    const bodies = [
      { exerciseId: SHORT, target: 'exercise', answer: { type: 'short_answer', text: 'x' } },
      factsReq({ exerciseId: UNKNOWN }), factsReq({ exerciseId: 'nope' }), factsReq({ exerciseId: DRAFT }),
    ];
    for (const body of bodies) {
      const d = deps();
      const r = await handleConsolidationEvaluate(body, 'u1', d);
      expect(r.status).toBe(404);
      expect(code(r)).toBe('not_found');
      expect(d.rateLimit).not.toHaveBeenCalled();
    }
  });

  it('returns not_found for an exercise that no longer validates, without consuming quota', async () => {
    const view = { type: 'viewpoint', text: 'Punctul meu de vedere.', marks: [] };
    const bodies = [
      factsReq({ exerciseId: NOCTX }), // no consolidation_ai_context row
      factsReq({ exerciseId: BLANKCTX }), // blank context
      { exerciseId: DETACHED, target: 'exercise', answer: view }, // detached span
    ];
    for (const body of bodies) {
      const d = deps();
      const r = await handleConsolidationEvaluate(body, 'u1', d);
      expect(code(r), JSON.stringify(body)).toBe('not_found');
      expect(d.rateLimit).not.toHaveBeenCalled();
      expect(d.evaluate).not.toHaveBeenCalled();
    }
  });

  it('rejects answers beyond the exercise bounds without consuming quota', async () => {
    const mark = { sourceId: SRC, from: 0, to: 3 };
    const bodies = [
      factsReq({ answer: { type: 'facts', texts: ['a', 'b', 'c'] } }),
      { exerciseId: VIEW, target: 'exercise', answer: { type: 'viewpoint', text: 'Da.', marks: [mark, mark, mark] } },
      { exerciseId: ESSAY, target: 'whole', answer: { type: 'essay', parts: { r1: 'a', r2: 'b', r3: 'c' } } },
      { exerciseId: ESSAY, target: { requirementId: 'r1' }, answer: { type: 'essay', parts: { r1: 'a', junk: 'x' } } },
    ];
    for (const body of bodies) {
      const d = deps();
      const r = await handleConsolidationEvaluate(body, 'u1', d);
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(code(r)).toBe('bad_request');
      expect(d.rateLimit).not.toHaveBeenCalled();
    }
    const d = deps({ evaluate: vi.fn(async () => okItems('viewpoint', 'support-0', 'support-1')) });
    const ok = await handleConsolidationEvaluate(
      { exerciseId: VIEW, target: 'exercise', answer: { type: 'viewpoint', text: 'Da.', marks: [mark, { sourceId: SRC, from: 4, to: 8 }] } }, 'u1', d,
    );
    expect(ok.status).toBe(200);
  });

  it('applies the target rules', async () => {
    const essay = { type: 'essay', parts: { r1: 'a', r2: 'b' } };
    const cases = [
      factsReq({ target: 'whole' }),
      factsReq({ target: { requirementId: 'r1' } }),
      { exerciseId: ESSAY, target: 'exercise', answer: essay },
      { exerciseId: ESSAY, target: { requirementId: 'nope' }, answer: essay },
    ];
    for (const body of cases) {
      const r = await handleConsolidationEvaluate(body, 'u1', deps());
      expect(code(r), JSON.stringify(body)).toBe('not_found');
    }
  });

  it('rejects empty and too-long text, counting code points', async () => {
    let r = await handleConsolidationEvaluate(factsReq({ answer: { type: 'facts', texts: ['ok', '  \n '] } }), 'u1', deps());
    expect(r.status).toBe(400);
    expect(code(r)).toBe('empty');
    const d = deps();
    r = await handleConsolidationEvaluate(factsReq({ answer: { type: 'facts', texts: ['😀'.repeat(3000), 'ok'] } }), 'u1', d);
    expect(r.status).toBe(200);
    r = await handleConsolidationEvaluate(factsReq({ answer: { type: 'facts', texts: ['a'.repeat(3001), 'ok'] } }), 'u1', d);
    expect(r.status).toBe(400);
    expect(r.json).toMatchObject({ error: 'too_long', message: 'Textul depășește 3000 de caractere.' });
    const e = deps();
    r = await handleConsolidationEvaluate(factsReq({ answer: { type: 'facts', texts: ['ok', 'ok'] }, exerciseId: FACTS }), 'u1', e);
    expect(e.rateLimit).toHaveBeenCalled();
  });

  it('does not consume quota for invalid answers', async () => {
    const d = deps();
    await handleConsolidationEvaluate(factsReq({ answer: { type: 'facts', texts: ['a', ''] } }), 'u1', d);
    expect(d.rateLimit).not.toHaveBeenCalled();
  });

  it('returns 429 without calling the evaluator when rate limited, and busy-day message for the global cap', async () => {
    let d = deps({ rateLimit: async () => false });
    let r = await handleConsolidationEvaluate(factsReq(), 'u1', d);
    expect(r.status).toBe(429);
    expect(r.json).toMatchObject({ error: 'rate_limited', message: 'Ai atins limita de evaluări pentru moment. Încearcă din nou peste o oră.' });
    expect(d.evaluate).not.toHaveBeenCalled();

    d = deps({ rateLimit: vi.fn(async (k: string) => k !== 'evaluate:global') });
    r = await handleConsolidationEvaluate(factsReq(), 'u1', d);
    expect(r.status).toBe(429);
    expect(r.json).toEqual({ error: 'rate_limited', message: 'Serviciul de evaluare este foarte solicitat azi. Încearcă din nou mâine.' });
  });

  it('returns ai_failed when the evaluator throws or the output is invalid', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const bad = [
      async () => { throw new Error('boom secret'); },
      async () => ({ nope: true }),
      async () => ({ items: [{ key: 'fact-0', verdict: 'great', title: 'T', good: [], improve: [] }] }),
    ];
    for (const evaluate of bad) {
      const credits = fakeCredits(5);
      const r = await handleConsolidationEvaluate(factsReq(), 'u1', deps({ evaluate, credits }));
      expect(r.status).toBe(502);
      expect(r.json).toEqual({
        error: 'ai_failed',
        message: 'Verificarea nu a reușit. Nu ți-am luat niciun credit. Încearcă din nou.',
        credits: { spent: 0, balance: 5 },
      });
      expect(credits.refund).toHaveBeenCalledTimes(1);
      expect(credits.refund).toHaveBeenCalledWith(1);
    }
  });

  it('truncates over-long model output instead of failing', async () => {
    const long = { key: 'fact-0', verdict: 'ok', title: 'x'.repeat(300), good: ['g'.repeat(900)], improve: [] };
    const evaluate = async () => ({ items: [long, { ...long, key: 'fact-1' }] });
    const r = await handleConsolidationEvaluate(factsReq(), 'u1', deps({ evaluate }));
    expect(r.status).toBe(200);
    const first = (r.json as { items: { title: string; good: string[] }[] }).items[0]!;
    expect(first.title).toHaveLength(120);
    expect(first.good[0]).toHaveLength(400);
  });

  it('drops unexpected keys and fails on a missing key', async () => {
    let r = await handleConsolidationEvaluate(factsReq(), 'u1', deps({ evaluate: async () => okItems('fact-0', 'fact-1', 'extra') }));
    expect((r.json as { items: { key: string }[] }).items.map((i) => i.key)).toEqual(['fact-0', 'fact-1']);
    const junk = Array.from({ length: 10 }, (_, i) => `junk-${i}`);
    r = await handleConsolidationEvaluate(factsReq(), 'u1', deps({ evaluate: async () => okItems(...junk, 'fact-0', 'fact-1') }));
    expect(r.status).toBe(200);
    expect((r.json as { items: { key: string }[] }).items.map((i) => i.key)).toEqual(['fact-0', 'fact-1']);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    r = await handleConsolidationEvaluate(factsReq(), 'u1', deps({ evaluate: async () => okItems('fact-0', 'extra') }));
    expect(code(r)).toBe('ai_failed');
  });

  it('viewpoint: rejected marks are not sent and get no support key', async () => {
    // words: Domnitorul(0) a(1) făcut(2) reforma.(3) Apoi(4) a(5) plecat(6) în(7) exil.(8)
    const answer = {
      type: 'viewpoint', text: 'Reforma a fost bună.',
      marks: [{ sourceId: SRC, from: 0, to: 3 }, { sourceId: SRC, from: 6, to: 7 }],
    };
    const d = deps({ evaluate: vi.fn(async () => okItems('viewpoint', 'support-0')) });
    const r = await handleConsolidationEvaluate({ exerciseId: VIEW, target: 'exercise', answer }, 'u1', d);
    expect(r.status).toBe(200);
    const { input } = vi.mocked(d.evaluate).mock.calls[0]![0];
    expect(input).toContain('support-0');
    expect(input).not.toContain('support-1');
    expect(input).toContain('Domnitorul a făcut reforma.');
    expect((r.json as { items: { key: string }[] }).items.map((i) => i.key)).toEqual(['viewpoint', 'support-0']);
  });

  it('viewpoint: needs a non-empty point of view and well-formed marks', async () => {
    let r = await handleConsolidationEvaluate({ exerciseId: VIEW, target: 'exercise', answer: { type: 'viewpoint', text: ' ', marks: [] } }, 'u1', deps());
    expect(code(r)).toBe('empty');
    r = await handleConsolidationEvaluate({ exerciseId: VIEW, target: 'exercise', answer: { type: 'viewpoint', text: 'a', marks: [{ from: 'x' }] } }, 'u1', deps());
    expect(code(r)).toBe('bad_request');
  });

  it('argument: sends the connector facts', async () => {
    const d = deps({ evaluate: vi.fn(async () => okItems('fact')) });
    const r = await handleConsolidationEvaluate({ exerciseId: ARG, target: 'exercise', answer: { type: 'argument', text: 'Deoarece a fost bine, deci da.' } }, 'u1', d);
    expect(r.status).toBe(200);
    expect(vi.mocked(d.evaluate).mock.calls[0]![0].input).toContain('cauzalitate da, concluzie da');
  });

  it('essay requirement: only that part is required and sent; connectors only for the argument flag', async () => {
    const d = deps({ evaluate: vi.fn(async () => okItems('r1')) });
    const r = await handleConsolidationEvaluate(
      { exerciseId: ESSAY, target: { requirementId: 'r1' }, answer: { type: 'essay', parts: { r1: 'Deoarece da.', r2: '' } } }, 'u1', d,
    );
    expect(r.status).toBe(200);
    const { input } = vi.mocked(d.evaluate).mock.calls[0]![0];
    expect(input).toContain('Ctx r1');
    expect(input).not.toContain('Ctx r2');
    expect(input).toContain('Conectori detectați automat');
  });

  it('essay whole: every part is required', async () => {
    const d = deps({ evaluate: vi.fn(async () => okItems('whole')) });
    let r = await handleConsolidationEvaluate({ exerciseId: ESSAY, target: 'whole', answer: { type: 'essay', parts: { r1: 'a', r2: ' ' } } }, 'u1', d);
    expect(code(r)).toBe('empty');
    r = await handleConsolidationEvaluate({ exerciseId: ESSAY, target: 'whole', answer: { type: 'essay', parts: { r1: 'a', r2: 'b' } } }, 'u1', d);
    expect(r.status).toBe(200);
    expect((r.json as { items: { key: string }[] }).items.map((i) => i.key)).toEqual(['whole']);
  });
});

describe('handleConsolidationEvaluate: credits', () => {
  const compReq = { exerciseId: COMP, target: 'exercise', answer: { type: 'comparison', text: 'Ambele au avut reforme.' } };
  const compOk = () => vi.fn(async () => okItems('answer'));

  it('spends checkCost with the target key after both rate limits, before the evaluator', async () => {
    const log: string[] = [];
    const credits = fakeCredits(7, log);
    const d = deps({
      credits,
      rateLimit: vi.fn(async (k: string) => (log.push(`rate:${k}`), true)),
      evaluate: vi.fn(async () => (log.push('ai'), okItems('answer'))),
    });
    const r = await handleConsolidationEvaluate(compReq, 'u1', d);
    expect(r.status).toBe(200);
    expect(log).toEqual(['rate:evaluate:user:u1', 'rate:evaluate:global', 'spend:2:exercise', 'ai']);
    expect(credits.spend).toHaveBeenCalledWith('u1', 2, COMP, 'exercise');
  });

  it('success returns what was spent and the new balance', async () => {
    const r = await handleConsolidationEvaluate(compReq, 'u1', deps({ credits: fakeCredits(7), evaluate: compOk() }));
    expect(r.status).toBe(200);
    expect((r.json as { credits: unknown }).credits).toEqual({ spent: 2, balance: 5 });
  });

  it('insufficient credits → 402 with required and balance; the evaluator is not called', async () => {
    const credits = fakeCredits(1);
    const d = deps({ credits, evaluate: compOk() });
    const r = await handleConsolidationEvaluate(compReq, 'u1', d);
    expect(r.status).toBe(402);
    expect(r.json).toEqual({
      error: 'insufficient_credits', message: 'Nu ai destule credite pentru această verificare.', required: 2, balance: 1,
    });
    expect(d.evaluate).not.toHaveBeenCalled();
    expect(credits.refund).not.toHaveBeenCalled();
  });

  it('the whole essay costs credit_cost per requirement; one requirement costs credit_cost', async () => {
    const credits = fakeCredits(10);
    let d = deps({ credits, evaluate: vi.fn(async () => okItems('whole')) });
    let r = await handleConsolidationEvaluate({ exerciseId: ESSAY, target: 'whole', answer: { type: 'essay', parts: { r1: 'a', r2: 'b' } } }, 'u1', d);
    expect(r.status).toBe(200);
    expect(credits.spend).toHaveBeenLastCalledWith('u1', 2, ESSAY, 'whole');
    expect((r.json as { credits: unknown }).credits).toEqual({ spent: 2, balance: 8 });
    d = deps({ credits, evaluate: vi.fn(async () => okItems('r1')) });
    r = await handleConsolidationEvaluate({ exerciseId: ESSAY, target: { requirementId: 'r1' }, answer: { type: 'essay', parts: { r1: 'a' } } }, 'u1', d);
    expect(credits.spend).toHaveBeenLastCalledWith('u1', 1, ESSAY, 'req:r1');
    expect((r.json as { credits: unknown }).credits).toEqual({ spent: 1, balance: 7 });
  });

  it('refunds when the evaluator throws or the model output is invalid', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const failures = [
      async () => { throw new Error('boom'); },
      async () => ({ nope: true }),
      async () => okItems('other'),
    ];
    for (const evaluate of failures) {
      const credits = fakeCredits(7);
      const r = await handleConsolidationEvaluate(compReq, 'u1', deps({ credits, evaluate }));
      expect(r.status).toBe(502);
      expect(r.json).toMatchObject({ error: 'ai_failed', credits: { spent: 0, balance: 7 } });
      expect(credits.refund).toHaveBeenCalledTimes(1);
      expect(credits.refund).toHaveBeenCalledWith(1);
    }
  });

  it('never spends on validation errors, not_found or rate limits', async () => {
    const bodies = [
      null,
      factsReq({ exerciseId: UNKNOWN }),
      factsReq({ exerciseId: DRAFT }),
      factsReq({ exerciseId: NOCTX }),
      factsReq({ answer: { type: 'facts', texts: ['a', ''] } }),
      factsReq({ answer: { type: 'facts', texts: ['a'.repeat(3001), 'b'] } }),
      factsReq({ target: 'whole' }),
    ];
    for (const body of bodies) {
      const credits = fakeCredits();
      await handleConsolidationEvaluate(body, 'u1', deps({ credits }));
      expect(credits.spend, JSON.stringify(body)).not.toHaveBeenCalled();
    }
    for (const rateLimit of [async () => false, async (k: string) => k !== 'evaluate:global']) {
      const credits = fakeCredits();
      const r = await handleConsolidationEvaluate(factsReq(), 'u1', deps({ credits, rateLimit }));
      expect(r.status).toBe(429);
      expect(credits.spend).not.toHaveBeenCalled();
    }
  });

  it('a failing refund still returns 502 with the old message, logged, without crashing', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const credits = fakeCredits(7);
    credits.refund.mockImplementation(async () => {
      throw new Error('refund down');
    });
    const r = await handleConsolidationEvaluate(compReq, 'u1', deps({ credits, evaluate: async () => { throw new Error('boom'); } }));
    expect(r.status).toBe(502);
    expect(r.json).toEqual({ error: 'ai_failed', message: 'Evaluarea nu a reușit. Încearcă din nou.' });
    expect(error.mock.calls.some((c) => String(c.join(' ')).includes('refund'))).toBe(true);
  });

  it('a failing spend is an ai_failed without calling the evaluator', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const credits = fakeCredits(7);
    credits.spend.mockImplementation(async () => {
      throw new Error('rpc down');
    });
    const d = deps({ credits, evaluate: compOk() });
    const r = await handleConsolidationEvaluate(compReq, 'u1', d);
    expect(r.status).toBe(502);
    expect(r.json).toEqual({ error: 'ai_failed', message: 'Evaluarea nu a reușit. Încearcă din nou.' });
    expect(d.evaluate).not.toHaveBeenCalled();
    expect(credits.refund).not.toHaveBeenCalled();
  });
});
