import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BacItemResult, BacSubmitResponse } from '@prepio/shared';
import type { Grader } from '@/lib/evaluate/openai';
import { captureFailure } from '@/lib/sentry';
import type { BacCharge } from './charge';
import { BAC_RATE_KEY, BAC_RATE_LIMIT, BAC_USER_RATE_LIMIT, bacUserRateKey, handleBacSubmit, type BacDeps } from './handler';

vi.mock('@/lib/sentry', () => ({ captureFailure: vi.fn() }));
const failure = vi.mocked(captureFailure);
beforeEach(() => failure.mockClear());
const ROUTE = 'bac/submit';

const USER = 'u1';
const SUBJ = '10000000-0000-4000-8000-000000000001';
const SA = '20000000-0000-4000-8000-000000000001';
const SB = '20000000-0000-4000-8000-000000000002';
const I_SHORT = '30000000-0000-4000-8000-000000000001';
const I_LETTER = '30000000-0000-4000-8000-000000000002';
const I_ARG = '30000000-0000-4000-8000-000000000003';
const I_FACTS = '30000000-0000-4000-8000-000000000004';
const I_COMP = '30000000-0000-4000-8000-000000000005';
const I_ESSAY = '30000000-0000-4000-8000-000000000006';

type Row = Record<string, unknown>;
const itemRow = (id: string, section: number, position: number, type: string, prompt: string, content: Row, points: number) => ({
  id, subject_id: SUBJ, section, position, type, prompt, content, points, template_id: 't',
});
const rule = (text: string, points: number, steps: number[] | null = null) => ({ text, points, steps, essay: null });

function seed(over: { published?: boolean; balance?: number } = {}): Record<string, Row[]> {
  return {
    bac_subjects: [{ id: SUBJ, title: 'Istorie 2026', credit_cost: 10, published: over.published ?? true }],
    bac_sources: [
      { id: SA, subject_id: SUBJ, section: 1, position: 0, title: null, author: 'a', work: 'w', body: 'Sursa A text.' },
      { id: SB, subject_id: SUBJ, section: 1, position: 1, title: null, author: 'b', work: 'w', body: 'Sursa B text.' },
    ],
    bac_items: [
      // Deliberately out of order: the handler sorts by section, then position.
      itemRow(I_ESSAY, 3, 0, 'essay', 'ENUNȚ-ESEU', {
        requirements: [
          { id: 'r1', text: 'CERINȚA-R1', argument: false },
          { id: 'r2', text: 'CERINȚA-R2', argument: true },
        ],
      }, 30),
      itemRow(I_LETTER, 1, 1, 'source_letter', 'ENUNȚ-LITERA', { correct: 'A', evidence: null }, 6),
      itemRow(I_SHORT, 1, 0, 'short_answer', 'ENUNȚ-SCURT', { accepted: ['Carol I'], mistakes: [] }, 10),
      itemRow(I_ARG, 1, 2, 'argument', 'ENUNȚ-ARG', {}, 10),
      itemRow(I_FACTS, 2, 0, 'facts', 'ENUNȚ-FACTS', { count: 2 }, 4),
      itemRow(I_COMP, 2, 1, 'comparison', 'ENUNȚ-COMP', { variant: 'similarity' }, 30),
    ],
    bac_item_sources: [
      { item_id: I_LETTER, label: 'A', source_id: SA, position: 0 },
      { item_id: I_LETTER, label: 'B', source_id: SB, position: 1 },
      { item_id: I_ARG, label: 'A', source_id: SA, position: 0 },
    ],
    bac_item_barem: [
      { item_id: I_SHORT, barem: rule('BAREM-SCURT', 10) },
      { item_id: I_LETTER, barem: rule('BAREM-LITERA', 6) },
      { item_id: I_ARG, barem: rule('BAREM-ARG', 10, [0, 7, 10]) },
      { item_id: I_FACTS, barem: rule('BAREM-FACTS', 4) },
      { item_id: I_COMP, barem: rule('BAREM-COMP', 30) },
      {
        item_id: I_ESSAY,
        barem: {
          text: 'BAREM-ESEU', points: 30, steps: null,
          essay: {
            requirements: { r1: { text: 'BAREM-R1', points: 12, steps: null }, r2: { text: 'BAREM-R2', points: 12, steps: null } },
            style: { language: 2, structure: 1, order: 2, length: 1 },
          },
        },
      },
    ],
    ai_settings: [{ id: 1, bac_rules: 'REGULI-BAC', model: 'gpt-5-mini' }],
    profiles: [{ id: USER, suspended_at: null, credit_balance: over.balance ?? 50 }],
    bac_attempts: [],
  };
}

type Err = { code?: string; message: string } | null;

/** A tiny in-memory PostgREST: select / update / insert with eq, in and order filters. */
function fakeDb(tables: Record<string, Row[]>, opts: { access?: boolean } = {}) {
  const events: Array<{ kind: string; details: unknown }> = [];
  let nextId = 1;
  const db = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      if (fn === 'can_open_bac_for') return { data: opts.access ?? true, error: null };
      if (fn === 'log_student_event_service') {
        events.push({ kind: args.p_kind as string, details: args.p_details });
        return { data: null, error: null };
      }
      return { data: null, error: { message: `unexpected rpc ${fn}` } };
    },
    from(table: string) {
      const rows = (tables[table] ??= []);
      let op: 'select' | 'update' | 'insert' = 'select';
      let patch: Row = {};
      const filters: Array<(r: Row) => boolean> = [];
      const orders: string[] = [];
      const run = (): { data: Row[]; error: Err } => {
        if (op === 'insert') {
          if (table === 'bac_attempts') {
            const open = ['draft', 'grading', 'failed'];
            const clash = rows.some(
              (r) => r.user_id === patch.user_id && r.subject_id === patch.subject_id && open.includes(r.status as string),
            );
            if (clash) return { data: [], error: { code: '23505', message: 'duplicate key' } };
          }
          const row = { id: `a${nextId++}`, ...patch };
          rows.push(row);
          return { data: [{ ...row }], error: null };
        }
        const hit = rows.filter((r) => filters.every((f) => f(r)));
        if (op === 'update') {
          for (const r of hit) Object.assign(r, patch);
          return { data: hit.map((r) => ({ ...r })), error: null };
        }
        const sorted = [...hit];
        for (const c of [...orders].reverse()) sorted.sort((a, b) => ((a[c] as number) ?? 0) - ((b[c] as number) ?? 0));
        return { data: sorted.map((r) => ({ ...r })), error: null };
      };
      const b: Record<string, unknown> = {
        select: () => b,
        update: (p: Row) => ((op = 'update'), (patch = p), b),
        insert: (p: Row) => ((op = 'insert'), (patch = p), b),
        eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), b),
        in: (c: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), b),
        order: (c: string) => (orders.push(c), b),
        maybeSingle: async () => {
          const r = run();
          return { data: r.data[0] ?? null, error: r.error };
        },
        single: async () => {
          const r = run();
          return r.error ? { data: null, error: r.error } : r.data[0] ? { data: r.data[0], error: null } : { data: null, error: { message: 'no rows' } };
        },
        then: (res: (v: unknown) => void, rej?: (e: unknown) => void) => Promise.resolve(run()).then(res, rej),
      };
      return b;
    },
  };
  return { db: db as unknown as SupabaseClient, events, tables };
}

function fakeCredits(balance = 50) {
  const entries = new Map<number, number>();
  let next = 1;
  return {
    get balance() {
      return balance;
    },
    spend: vi.fn(async (_u: string, amount: number, _e: string | null, _t: string) => {
      if (balance < amount) return { entryId: null, balance };
      balance -= amount;
      entries.set(next, amount);
      return { entryId: next++, balance };
    }),
    refund: vi.fn(async (entryId: number) => {
      balance += entries.get(entryId) ?? 0;
      entries.delete(entryId);
      return balance;
    }),
  };
}

type GradeArgs = Parameters<Grader>[0];
/** Answers by the marker found in the prompt; `style` answers the essay's style call. */
function grader(by: Record<string, unknown> = {}, fallback: unknown = { points: 0, feedback: 'Mai lucrează la răspuns.' }) {
  return vi.fn<Grader>(async (a: GradeArgs) => {
    if (a.kind === 'style') return by.style ?? { language: 0, structure: 0, order: 0, feedback: 'Ordonează ideile.' };
    for (const marker of ['CERINȚA-R1', 'CERINȚA-R2', 'ENUNȚ-ARG', 'ENUNȚ-FACTS', 'ENUNȚ-COMP']) {
      if (a.input.includes(marker) && by[marker] !== undefined) return by[marker];
    }
    return fallback;
  });
}

type SetupOpts = {
  access?: boolean;
  suspended?: boolean;
  balance?: number;
  grade?: Grader;
  rate?: boolean | ((key: string) => boolean);
  published?: boolean;
};
function setup(o: SetupOpts = {}) {
  const tables = seed({ published: o.published, balance: o.balance });
  if (o.suspended) tables.profiles![0]!.suspended_at = '2026-11-09T10:00:00Z';
  const f = fakeDb(tables, { access: o.access });
  const credits = fakeCredits(o.balance ?? 50);
  // Like bac_charge_attempt: only the caller's grading attempt; spend and ledger_entry together.
  const charge = vi.fn<BacCharge>(async (attemptId, userId, amount, target) => {
    const attempt = tables.bac_attempts!.find((a) => a.id === attemptId && a.user_id === userId && a.status === 'grading');
    if (!attempt) throw new Error('bac_charge_attempt failed: attempt_not_grading');
    const spent = await credits.spend(userId, amount, null, target);
    if (spent.entryId !== null) attempt.ledger_entry = spent.entryId;
    return spent;
  });
  const rate = o.rate ?? true;
  const deps: BacDeps & { charge: typeof charge } = {
    db: f.db,
    grade: o.grade ?? grader(),
    rateLimit: vi.fn(async (key: string) => (typeof rate === 'function' ? rate(key) : rate)),
    credits,
    charge,
    now: () => new Date('2026-11-09T12:00:00Z'),
  };
  return { ...f, credits, deps };
}

const words = (n: number) => Array.from({ length: n }, () => 'cuvânt').join(' ');
const fullAnswers = () => ({
  [I_SHORT]: { type: 'short_answer', text: 'Carol I' },
  [I_LETTER]: { type: 'source_letter', letter: 'A' },
  [I_ARG]: { type: 'argument', text: 'Deoarece Unirea a avut loc, statul s-a modernizat.' },
  [I_FACTS]: { type: 'facts', texts: ['Primul fapt', 'Al doilea fapt'] },
  [I_COMP]: { type: 'comparison', text: 'Ambele state au avut constituții.' },
  [I_ESSAY]: { type: 'essay', parts: { r1: words(200), r2: words(150) } },
});
const body = (answers: Record<string, unknown> = fullAnswers()) => ({ subjectId: SUBJ, answers });
const code = (r: { json: unknown }) => (r.json as { error: string }).error;
const result = (r: { json: unknown }, id: string) => (r.json as BacSubmitResponse).results.find((x) => x.itemId === id)!;

describe('handleBacSubmit', () => {
  it('returns 403 suspended before anything else', async () => {
    const s = setup({ suspended: true, access: false });
    const r = await handleBacSubmit(body(), USER, s.deps);
    expect(r.status).toBe(403);
    expect(code(r)).toBe('suspended');
    expect(s.deps.rateLimit).not.toHaveBeenCalled();
    expect(s.credits.spend).not.toHaveBeenCalled();
  });

  it('returns 403 access_required for a trial student and spends nothing', async () => {
    const s = setup({ access: false });
    const r = await handleBacSubmit(body(), USER, s.deps);
    expect(r.status).toBe(403);
    expect(code(r)).toBe('access_required');
    expect(s.credits.spend).not.toHaveBeenCalled();
    expect(s.deps.grade).not.toHaveBeenCalled();
    expect(s.tables.bac_attempts).toEqual([]);
  });

  it('rejects malformed bodies and over-long texts', async () => {
    const bad = [
      null, {}, { subjectId: 'nope', answers: {} }, { subjectId: SUBJ }, { subjectId: SUBJ, answers: [] },
      body({ [I_SHORT]: { type: 'short_answer', text: 3 } }),
      body({ [I_FACTS]: { type: 'facts', texts: ['a', null] } }),
      body({ [I_ESSAY]: { type: 'essay', parts: { r1: 5 } } }),
      body({ [I_LETTER]: { type: 'source_letter', letter: 'Z' } }),
    ];
    for (const b of bad) {
      const s = setup();
      const r = await handleBacSubmit(b, USER, s.deps);
      expect(r.status, JSON.stringify(b)).toBe(400);
      expect(code(r)).toBe('bad_request');
    }
    const s = setup();
    const r = await handleBacSubmit(body({ [I_COMP]: { type: 'comparison', text: 'x'.repeat(3001) } }), USER, s.deps);
    expect(r.status).toBe(400);
    expect(code(r)).toBe('too_long');
    expect(s.credits.spend).not.toHaveBeenCalled();
  });

  it('returns 404 for an unpublished subject', async () => {
    const s = setup({ published: false });
    const r = await handleBacSubmit(body(), USER, s.deps);
    expect(r.status).toBe(404);
    expect(code(r)).toBe('not_found');
    expect(s.credits.spend).not.toHaveBeenCalled();
  });

  it('returns 429 rate_limited when the global cap is reached and spends nothing', async () => {
    const s = setup({ rate: (key) => key !== BAC_RATE_KEY });
    const r = await handleBacSubmit(body(), USER, s.deps);
    expect(r).toEqual({
      status: 429,
      json: { error: 'rate_limited', message: 'Corectarea nu este disponibilă acum. Încearcă din nou mai târziu.' },
    });
    expect(s.deps.rateLimit).toHaveBeenCalledWith(BAC_RATE_KEY, BAC_RATE_LIMIT, 86400);
    expect(BAC_RATE_KEY).toBe('bac:global');
    expect(BAC_RATE_LIMIT).toBe(60);
    expect(s.credits.spend).not.toHaveBeenCalled();
    expect(s.tables.bac_attempts).toEqual([]);
  });

  it('checks the per-user daily cap before the global one', async () => {
    const s = setup();
    await handleBacSubmit(body(), USER, s.deps);
    expect(BAC_USER_RATE_LIMIT).toBe(5);
    expect(vi.mocked(s.deps.rateLimit).mock.calls).toEqual([
      [bacUserRateKey(USER), BAC_USER_RATE_LIMIT, 86400],
      [BAC_RATE_KEY, BAC_RATE_LIMIT, 86400],
    ]);
    expect(bacUserRateKey(USER)).toBe('bac:user:u1');
  });

  it('returns 429 rate_limited at the per-user cap without consuming the global slot', async () => {
    const s = setup({ rate: (key) => key !== bacUserRateKey(USER) });
    const r = await handleBacSubmit(body(), USER, s.deps);
    expect(r).toEqual({
      status: 429,
      json: { error: 'rate_limited', message: 'Corectarea nu este disponibilă acum. Încearcă din nou mai târziu.' },
    });
    expect(s.deps.rateLimit).not.toHaveBeenCalledWith(BAC_RATE_KEY, expect.anything(), expect.anything());
    expect(s.deps.charge).not.toHaveBeenCalled();
    expect(s.tables.bac_attempts).toEqual([]);
  });

  it('returns 402 insufficient_credits before any rate limit when the balance is below the cost', async () => {
    const s = setup({ balance: 3 });
    const r = await handleBacSubmit(body(), USER, s.deps);
    expect(r.status).toBe(402);
    expect(r.json).toMatchObject({ error: 'insufficient_credits', required: 10, balance: 3 });
    expect(s.deps.rateLimit).not.toHaveBeenCalled();
    expect(s.deps.charge).not.toHaveBeenCalled();
    expect(s.tables.bac_attempts).toEqual([]);
  });

  it('returns 409 already_grading before any rate limit when the subject is being graded', async () => {
    const s = setup();
    s.tables.bac_attempts!.push({ id: 'busy', user_id: USER, subject_id: SUBJ, status: 'grading', answers: {}, ledger_entry: 4 });
    const r = await handleBacSubmit(body(), USER, s.deps);
    expect(r.status).toBe(409);
    expect(code(r)).toBe('already_grading');
    expect(s.deps.rateLimit).not.toHaveBeenCalled();
    expect(s.deps.charge).not.toHaveBeenCalled();
  });

  it('returns 402 when the charge finds the balance spent meanwhile and puts the attempt back to draft', async () => {
    const s = setup({ balance: 3 });
    s.tables.profiles![0]!.credit_balance = 50; // the pre-check saw enough; the charge does not
    const r = await handleBacSubmit(body(), USER, s.deps);
    expect(r.status).toBe(402);
    expect(r.json).toMatchObject({ error: 'insufficient_credits', required: 10, balance: 3 });
    expect(s.deps.grade).not.toHaveBeenCalled();
    expect(s.tables.bac_attempts).toHaveLength(1);
    expect(s.tables.bac_attempts![0]).toMatchObject({ status: 'draft', user_id: USER, subject_id: SUBJ });
    expect(s.tables.bac_attempts![0]!.ledger_entry ?? null).toBeNull();
  });

  it('charges through the atomic charge with the attempt, user, cost and target', async () => {
    const s = setup();
    const r = await handleBacSubmit(body(), USER, s.deps);
    expect(r.status).toBe(200);
    expect(s.deps.charge).toHaveBeenCalledWith('a1', USER, 10, `bac:${SUBJ}`);
  });

  it('a charge that committed but whose response was lost is refunded from the stored entry', async () => {
    const s = setup();
    const real = s.deps.charge;
    s.deps.charge = vi.fn(async (...args: Parameters<BacCharge>) => {
      await real(...args);
      throw new Error('fetch failed');
    });
    const r = await handleBacSubmit(body(), USER, s.deps);
    expect(r.status).toBe(502);
    expect(r.json).toMatchObject({ error: 'grading_failed', credits: { spent: 0, balance: 50 } });
    expect(s.credits.refund).toHaveBeenCalledWith(1);
    expect(s.credits.balance).toBe(50);
    expect(s.tables.bac_attempts![0]).toMatchObject({ status: 'failed', ledger_entry: 1 });
    expect(s.deps.grade).not.toHaveBeenCalled();
  });

  it('a charge that failed before committing refunds nothing and fails the attempt', async () => {
    const s = setup();
    s.deps.charge = vi.fn<BacCharge>(async () => {
      throw new Error('fetch failed');
    });
    const r = await handleBacSubmit(body(), USER, s.deps);
    expect(r.status).toBe(502);
    expect(code(r)).toBe('grading_failed');
    expect(s.credits.refund).not.toHaveBeenCalled();
    expect(s.tables.bac_attempts![0]).toMatchObject({ status: 'failed' });
    expect(s.tables.bac_attempts![0]!.ledger_entry ?? null).toBeNull();
  });

  it('reuses the open draft and spends the subject cost once with a null exercise', async () => {
    const s = setup();
    s.tables.bac_attempts!.push({ id: 'draft-1', user_id: USER, subject_id: SUBJ, status: 'draft', answers: {}, ledger_entry: null });
    const r = await handleBacSubmit(body(), USER, s.deps);
    expect(r.status).toBe(200);
    expect((r.json as BacSubmitResponse).attemptId).toBe('draft-1');
    expect(s.tables.bac_attempts).toHaveLength(1);
    expect(s.credits.spend).toHaveBeenCalledTimes(1);
    expect(s.credits.spend).toHaveBeenCalledWith(USER, 10, null, `bac:${SUBJ}`);
    expect(s.tables.bac_attempts![0]).toMatchObject({ status: 'graded', ledger_entry: 1, answers: fullAnswers() });
    expect(s.events.map((e) => e.kind)).toEqual(['bac_submitted', 'bac_graded']);
    expect(s.events[0]!.details).toEqual({ subject_id: SUBJ, cost: 10 });
  });

  it('rejects a second submit while grading', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let started!: () => void;
    const inGrading = new Promise<void>((r) => (started = r));
    const slow = vi.fn<Grader>(async (a) => {
      started();
      await gate;
      return a.kind === 'style' ? { language: 0, structure: 0, order: 0, feedback: '' } : { points: 0, feedback: '' };
    });
    const s = setup({ grade: slow });
    const first = handleBacSubmit(body(), USER, s.deps);
    await inGrading;
    const second = await handleBacSubmit(body(), USER, s.deps);
    expect(second.status).toBe(409);
    expect(second.json).toEqual({ error: 'already_grading', message: 'Lucrarea se corectează deja.' });
    release();
    expect((await first).status).toBe(200);
    expect(s.credits.spend).toHaveBeenCalledTimes(1);
  });

  it('scores deterministic items without calling the grader', async () => {
    const s = setup();
    const r = await handleBacSubmit(
      body({ [I_SHORT]: { type: 'short_answer', text: 'Carol I' }, [I_LETTER]: { type: 'source_letter', letter: 'B' } }),
      USER,
      s.deps,
    );
    expect(r.status).toBe(200);
    expect(s.deps.grade).not.toHaveBeenCalled();
    expect(result(r, I_SHORT)).toMatchObject({ points: 10, max: 10, feedback: '', section: 1, number: 1 });
    expect(result(r, I_LETTER)).toMatchObject({ points: 0, max: 6, section: 1, number: 2 });
    expect(result(r, I_LETTER).feedback).not.toBe('');
  });

  it('clampToStep applies to AI points', async () => {
    const s = setup({ grade: grader({ 'ENUNȚ-ARG': { points: 8, feedback: 'Lipsește concluzia. Mai mult text.' }, 'ENUNȚ-FACTS': { points: 99, feedback: 'Bine.' } }) });
    const r = await handleBacSubmit(
      body({ [I_ARG]: fullAnswers()[I_ARG], [I_FACTS]: fullAnswers()[I_FACTS] }),
      USER,
      s.deps,
    );
    expect(r.status).toBe(200);
    expect(result(r, I_ARG)).toMatchObject({ points: 7, max: 10, feedback: 'Lipsește concluzia.' });
    // Full points clear the feedback.
    expect(result(r, I_FACTS)).toMatchObject({ points: 4, max: 4, feedback: '' });
    const argCall = vi.mocked(s.deps.grade).mock.calls.find((c) => c[0].input.includes('ENUNȚ-ARG'))![0];
    expect(argCall).toMatchObject({ kind: 'item', model: 'gpt-5-mini' });
    expect(argCall.input).toContain('Trepte permise: 0, 7, 10');
    expect(argCall.input).toContain('BAREM-ARG');
    expect(argCall.input).toContain('Sursa A text.');
    expect(argCall.input).toContain('cauzalitate da');
    expect(argCall.instructions).toContain('REGULI-BAC');
  });

  it('makes no grader call for an empty AI answer and scores Necompletat', async () => {
    const s = setup();
    const r = await handleBacSubmit(
      body({ [I_COMP]: { type: 'comparison', text: '   ' }, [I_ESSAY]: { type: 'essay', parts: { r1: '', r2: ' ' } } }),
      USER,
      s.deps,
    );
    expect(r.status).toBe(200);
    expect(s.deps.grade).not.toHaveBeenCalled();
    expect(result(r, I_COMP)).toMatchObject({ points: 0, feedback: 'Necompletat.' });
    expect(result(r, I_FACTS)).toMatchObject({ points: 0, feedback: 'Necompletat.' });
    expect(result(r, I_ESSAY)).toMatchObject({ points: 0, max: 30, feedback: 'Necompletat.' });
  });

  it('refunds and marks failed when one grader call throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const boom = vi.fn<Grader>(async (a) => {
      if (a.input.includes('ENUNȚ-COMP')) throw new Error('timeout');
      return a.kind === 'style' ? { language: 0, structure: 0, order: 0, feedback: '' } : { points: 0, feedback: '' };
    });
    const s = setup({ grade: boom });
    const r = await handleBacSubmit(body(), USER, s.deps);
    expect(r.status).toBe(502);
    expect(r.json).toEqual({
      error: 'grading_failed',
      message: 'Corectarea nu a reușit. Nu ți-am luat niciun credit. Încearcă din nou.',
      credits: { spent: 0, balance: 50 },
    });
    expect(s.credits.refund).toHaveBeenCalledWith(1);
    expect(s.tables.bac_attempts![0]).toMatchObject({ status: 'failed', answers: fullAnswers() });
    expect(s.tables.bac_attempts![0]!.results ?? null).toBeNull();
    expect(s.events.map((e) => e.kind)).toEqual(['bac_submitted', 'bac_grading_failed']);
  });

  it('treats a malformed grader output as a failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const s = setup({ grade: grader({ 'ENUNȚ-FACTS': { points: 1.5, feedback: '' } }) });
    const r = await handleBacSubmit(body(), USER, s.deps);
    expect(r.status).toBe(502);
    expect(s.credits.refund).toHaveBeenCalledWith(1);
  });

  it('reopens a failed attempt with a fresh ledger entry and no stale results', async () => {
    const s = setup();
    s.tables.bac_attempts!.push({
      id: 'old', user_id: USER, subject_id: SUBJ, status: 'failed', answers: {}, ledger_entry: 77, points: 3, grade: 1.3, results: [{}],
      graded_at: 'x',
    });
    let seen: Row | undefined;
    const spy = vi.fn<Grader>(async (a) => {
      seen ??= { ...s.tables.bac_attempts![0]! };
      return a.kind === 'style' ? { language: 0, structure: 0, order: 0, feedback: '' } : { points: 0, feedback: '' };
    });
    s.deps.grade = spy;
    const r = await handleBacSubmit(body(), USER, s.deps);
    expect(r.status).toBe(200);
    expect(seen).toMatchObject({ status: 'grading', ledger_entry: 1, points: null, grade: null, results: null, graded_at: null });
    expect(s.credits.refund).not.toHaveBeenCalled();
  });

  it('does not refund again when the stale sweep already failed the attempt', async () => {
    const s = setup({ balance: 50 });
    s.tables.profiles![0]!.credit_balance = 50; // the sweep's refund already happened
    const sweep = vi.fn<Grader>(async (a) => {
      s.tables.bac_attempts![0]!.status = 'failed';
      return a.kind === 'style' ? { language: 0, structure: 0, order: 0, feedback: '' } : { points: 0, feedback: '' };
    });
    s.deps.grade = sweep;
    const r = await handleBacSubmit(body(), USER, s.deps);
    expect(r.status).toBe(502);
    expect(r.json).toMatchObject({ error: 'grading_failed', credits: { spent: 0, balance: 50 } });
    expect(s.credits.refund).not.toHaveBeenCalled();
    expect(s.tables.bac_attempts![0]!.status).toBe('failed');
    expect(s.events.map((e) => e.kind)).toEqual(['bac_submitted']);
  });

  it('computes the essay from requirement, style and length parts', async () => {
    const s = setup({
      grade: grader({
        'CERINȚA-R1': { points: 12, feedback: 'Nimic.' },
        'CERINȚA-R2': { points: 6, feedback: 'Adaugă un fapt istoric. Și altceva.' },
        style: { language: 2, structure: 0, order: 5, feedback: 'Lipsește încheierea.' },
      }),
    });
    const r = await handleBacSubmit(body({ [I_ESSAY]: fullAnswers()[I_ESSAY] }), USER, s.deps);
    expect(r.status).toBe(200);
    const essay = result(r, I_ESSAY);
    expect(essay.parts).toEqual([
      { key: 'r1', points: 12, max: 12, feedback: '' },
      { key: 'r2', points: 6, max: 12, feedback: 'Adaugă un fapt istoric.' },
      { key: 'language', points: 2, max: 2, feedback: '' },
      { key: 'structure', points: 0, max: 1, feedback: 'Lipsește încheierea.' },
      { key: 'order', points: 2, max: 2, feedback: '' },
      { key: 'length', points: 1, max: 1, feedback: '' },
    ]);
    expect(essay).toMatchObject({ points: 23, max: 30, feedback: 'Adaugă un fapt istoric.', section: 3, number: 1 });
    expect(vi.mocked(s.deps.grade).mock.calls.filter((c) => c[0].kind === 'style')).toHaveLength(1);
    const r1Call = vi.mocked(s.deps.grade).mock.calls.find((c) => c[0].input.includes('CERINȚA-R1'))![0];
    expect(r1Call.input).toContain('BAREM-R1');
    expect(r1Call.input).not.toContain('BAREM-R2');
    // r2 has the argument flag: the connector facts go with it.
    const r2Call = vi.mocked(s.deps.grade).mock.calls.find((c) => c[0].input.includes('CERINȚA-R2'))![0];
    expect(r2Call.input).toContain('Conectori detectați automat');
  });

  it('grades 74 points as 8.4 and stores the results', async () => {
    const s = setup({
      grade: grader({
        'ENUNȚ-ARG': { points: 10, feedback: '' },
        'ENUNȚ-FACTS': { points: 4, feedback: '' },
        'ENUNȚ-COMP': { points: 20, feedback: 'Precizează asemănarea.' },
        'CERINȚA-R1': { points: 12, feedback: '' },
        'CERINȚA-R2': { points: 6, feedback: 'Adaugă un fapt.' },
        style: { language: 2, structure: 1, order: 2, feedback: '' },
      }),
    });
    const r = await handleBacSubmit(body(), USER, s.deps);
    expect(r.status).toBe(200);
    const json = r.json as BacSubmitResponse;
    expect(json).toMatchObject({ points: 74, grade: 8.4, credits: { spent: 10, balance: 40 } });
    expect(json.results.map((x) => `${x.section}.${x.number}`)).toEqual(['1.1', '1.2', '1.3', '2.1', '2.2', '3.1']);
    const stored = s.tables.bac_attempts![0]!;
    expect(stored).toMatchObject({ status: 'graded', points: 74, grade: 8.4, graded_at: '2026-11-09T12:00:00.000Z', ledger_entry: 1 });
    expect(stored.results).toEqual(json.results);
    // Students read `results`: no barem text, only the result fields.
    expect(JSON.stringify(stored.results)).not.toMatch(/BAREM/);
    for (const x of stored.results as BacItemResult[]) {
      expect(Object.keys(x).sort()).toEqual(
        x.parts ? ['feedback', 'itemId', 'max', 'number', 'parts', 'points', 'section'] : ['feedback', 'itemId', 'max', 'number', 'points', 'section'],
      );
    }
    expect(s.events.at(-1)).toEqual({ kind: 'bac_graded', details: { subject_id: SUBJ, points: 74, grade: 8.4 } });
  });
});

describe('handleBacSubmit: Sentry', () => {
  const quiet = () => vi.spyOn(console, 'error').mockImplementation(() => {});
  const okGrade = (a: Parameters<Grader>[0]) =>
    a.kind === 'style' ? { language: 0, structure: 0, order: 0, feedback: '' } : { points: 0, feedback: '' };

  it('reports nothing for a graded paper', async () => {
    const r = await handleBacSubmit(body(), USER, setup().deps);
    expect(r.status).toBe(200);
    expect(failure).not.toHaveBeenCalled();
  });

  it('a throwing grader is reported as grade, never with its message', async () => {
    quiet();
    const s = setup({
      grade: vi.fn<Grader>(async (a) => {
        if (a.input.includes('ENUNȚ-COMP')) throw new Error('model quoted the answer');
        return okGrade(a);
      }),
    });
    await handleBacSubmit(body(), USER, s.deps);
    expect(failure.mock.calls).toEqual([[ROUTE, 'grade', expect.any(Error), 502]]);
  });

  it('a failing refund is reported as refund', async () => {
    quiet();
    const s = setup({ grade: vi.fn<Grader>(async () => { throw new Error('timeout'); }) });
    s.credits.refund.mockImplementation(async () => {
      throw new Error('refund down');
    });
    await handleBacSubmit(body(), USER, s.deps);
    expect(failure.mock.calls).toEqual([
      [ROUTE, 'grade', expect.any(Error), 502],
      [ROUTE, 'refund', expect.objectContaining({ message: 'refund down' }), 502],
    ]);
  });

  it('an attempt the stale sweep failed meanwhile is reported as stuck_grading, with no error', async () => {
    quiet();
    const s = setup();
    s.deps.grade = vi.fn<Grader>(async (a) => {
      s.tables.bac_attempts![0]!.status = 'failed';
      return okGrade(a);
    });
    await handleBacSubmit(body(), USER, s.deps);
    expect(failure.mock.calls).toEqual([[ROUTE, 'stuck_grading', undefined, 502]]);
  });

  it('a failing timeline log is reported as log_event', async () => {
    quiet();
    const s = setup();
    const db = s.db as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<unknown> };
    const rpc = db.rpc;
    db.rpc = async (fn, args) => (fn === 'log_student_event_service' ? { data: null, error: { message: 'down' } } : rpc(fn, args));
    const r = await handleBacSubmit(body(), USER, s.deps);
    expect(r.status).toBe(200);
    expect(failure.mock.calls).toEqual([
      [ROUTE, 'log_event', expect.any(Error)],
      [ROUTE, 'log_event', expect.any(Error)],
    ]);
  });
});
