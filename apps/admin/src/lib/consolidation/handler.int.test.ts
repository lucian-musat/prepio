import { config } from 'dotenv';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { handleConsolidationEvaluate, type Deps } from './handler';
import { createRateLimit, GLOBAL_RATE_KEY, type RateLimit } from '@/lib/evaluate/rateLimit';
import { createCredits, type Credits } from '@/lib/credits/credits';

config({ path: [resolve(__dirname, '../../../.env.local'), resolve(__dirname, '../../../../../.env')], quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!url || !service)('handleConsolidationEvaluate (local Supabase)', () => {
  let db: SupabaseClient;
  let nodeId: string;
  let lessonId: string;
  let draftLessonId: string;
  let exerciseId: string;
  let draftExerciseId: string;
  // Every rate-limit key is rewritten under a unique prefix, so real quotas are never consumed.
  const prefix = `test-${randomUUID()}:`;
  // A real student (welcome grant: 12 credits), so the checks go through spend_credits / refund_credits.
  let userId: string;
  let credits: Credits;
  let rateLimit: RateLimit;
  const testKey = (key: string) => `${prefix}${key}`;
  const requirements = [
    { id: 'r1', text: '[test] Cerința 1', modelAnswer: null, templateId: null, argument: true },
    { id: 'r2', text: '[test] Cerința 2', modelAnswer: null, templateId: null, argument: false },
  ];

  async function insertExercise(lesson: string, creditCost = 1): Promise<string> {
    const e = await db
      .from('consolidation_exercises')
      .insert({
        lesson_id: lesson, position: 0, type: 'essay', prompt: '[test] eseu', content: { requirements }, template_id: null, credit_cost: creditCost,
      })
      .select('id')
      .single();
    if (e.error) throw e.error;
    const c = await db
      .from('consolidation_ai_context')
      .insert({ exercise_id: e.data.id, context: { main: '', requirements: { r1: 'CTX-UNU', r2: 'CTX-DOI' } } });
    if (c.error) throw c.error;
    return e.data.id;
  }

  beforeAll(async () => {
    db = createClient(url!, service!, { auth: { persistSession: false } });
    const real = createRateLimit(db);
    rateLimit = (key, limit, windowSeconds) => real(testKey(key), limit, windowSeconds);
    credits = createCredits(db);
    const email = `test-evaluate-${randomUUID()}@prepio.local`;
    const u = await db.auth.admin.createUser({ email, password: 'test-password-123', email_confirm: true });
    if (u.error) throw u.error;
    userId = u.data.user.id;
    const n = await db.from('nodes').insert({ title: '[test] consolidation evaluate' }).select('id').single();
    if (n.error) throw n.error;
    nodeId = n.data.id;
    const l = await db.from('lessons').insert({ node_id: nodeId, title: '[test] published', status: 'published' }).select('id').single();
    if (l.error) throw l.error;
    lessonId = l.data.id;
    const d = await db.from('lessons').insert({ node_id: nodeId, title: '[test] draft', status: 'draft', position: 1 }).select('id').single();
    if (d.error) throw d.error;
    draftLessonId = d.data.id;
    exerciseId = await insertExercise(lessonId);
    draftExerciseId = await insertExercise(draftLessonId);
  });

  afterAll(async () => {
    if (userId) await db.auth.admin.deleteUser(userId); // the ledger rows go with it
    if (nodeId) await db.from('nodes').delete().eq('id', nodeId);
    await db.from('rate_limits').delete().like('key', `${prefix}%`);
  });

  const deps = (evaluate: Deps['evaluate'], c: Credits = credits): Deps => ({ db, rateLimit, evaluate, credits: c });
  /** For the non-uuid rate-limit user: never runs out. */
  const unlimited: Credits = { spend: async () => ({ entryId: 1, balance: 99 }), refund: async () => 99 };
  const balance = async () => {
    const { data, error } = await db.from('profiles').select('credit_balance').eq('id', userId).single();
    if (error) throw error;
    return data.credit_balance as number;
  };
  const ledger = async () => {
    const { data, error } = await db.from('credit_ledger').select('id,kind,delta,balance_after,exercise_id,target,refund_of').eq('user_id', userId).order('id');
    if (error) throw error;
    return data;
  };
  const item = (key: string) => ({ key, verdict: 'almost', title: 'T', good: ['g'], improve: ['i'] });

  it('evaluates one requirement, sending the DB context and connector facts', async () => {
    const evaluate = vi.fn(async (_a: Parameters<Deps['evaluate']>[0]) => ({ items: [item('r1')] }));
    const r = await handleConsolidationEvaluate(
      { exerciseId, target: { requirementId: 'r1' }, answer: { type: 'essay', parts: { r1: 'Deoarece da. Deci așa.', r2: '' } } },
      userId,
      deps(evaluate),
    );
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ items: [{ ...item('r1'), ai: true }], credits: { spent: 1, balance: 11 } });
    expect(await balance()).toBe(11);
    expect((await ledger()).at(-1)).toMatchObject({ kind: 'check', delta: -1, balance_after: 11, exercise_id: exerciseId, target: 'req:r1' });
    const { input } = evaluate.mock.calls[0]![0] as { input: string };
    expect(input).toContain('CTX-UNU');
    expect(input).not.toContain('CTX-DOI');
    expect(input).toContain('cauzalitate da, concluzie da');
  });

  it('evaluates the whole essay once every part is filled', async () => {
    const evaluate = vi.fn(async (_a: Parameters<Deps['evaluate']>[0]) => ({ items: [item('whole'), item('r1')] }));
    const answer = { type: 'essay', parts: { r1: 'Text unu', r2: 'Text doi' } };
    const r = await handleConsolidationEvaluate({ exerciseId, target: 'whole', answer }, userId, deps(evaluate));
    expect(r.status).toBe(200);
    expect((r.json as { items: { key: string }[] }).items.map((i) => i.key)).toEqual(['whole']);
    // 2 requirements × credit_cost 1
    expect((r.json as { credits: unknown }).credits).toEqual({ spent: 2, balance: 9 });
    const { input } = evaluate.mock.calls[0]![0] as { input: string };
    expect(input).toContain('CTX-UNU');
    expect(input).toContain('CTX-DOI');

    const missing = { type: 'essay', parts: { r1: 'Text unu', r2: '' } };
    const e = await handleConsolidationEvaluate({ exerciseId, target: 'whole', answer: missing }, userId, deps(evaluate));
    expect(e.status).toBe(400);
    expect(e.json).toMatchObject({ error: 'empty' });
    expect(await balance()).toBe(9);
  });

  it('gives the credits back when the evaluation fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const evaluate = vi.fn(async () => {
      throw new Error('boom');
    });
    const r = await handleConsolidationEvaluate(
      { exerciseId, target: 'whole', answer: { type: 'essay', parts: { r1: 'a', r2: 'b' } } }, userId, deps(evaluate),
    );
    expect(r.status).toBe(502);
    expect(r.json).toEqual({
      error: 'ai_failed', message: 'Verificarea nu a reușit. Nu ți-am luat niciun credit. Încearcă din nou.', credits: { spent: 0, balance: 9 },
    });
    expect(await balance()).toBe(9);
    const [check, refund] = (await ledger()).slice(-2);
    expect(check).toMatchObject({ kind: 'check', delta: -2, target: 'whole' });
    expect(refund).toMatchObject({ kind: 'refund', delta: 2, balance_after: 9, refund_of: check!.id });
  });

  it('refuses a check the balance cannot cover, without calling the evaluator', async () => {
    const pricey = await insertExercise(lessonId, 5); // whole essay: 2 × 5 = 10 > 9
    const evaluate = vi.fn();
    const before = (await ledger()).length;
    const r = await handleConsolidationEvaluate(
      { exerciseId: pricey, target: 'whole', answer: { type: 'essay', parts: { r1: 'a', r2: 'b' } } }, userId, deps(evaluate),
    );
    expect(r.status).toBe(402);
    expect(r.json).toEqual({
      error: 'insufficient_credits', message: 'Nu ai destule credite pentru această verificare.', required: 10, balance: 9,
    });
    expect(evaluate).not.toHaveBeenCalled();
    expect(await balance()).toBe(9);
    expect(await ledger()).toHaveLength(before);
  });

  it('does not serve an exercise of an unpublished lesson', async () => {
    const evaluate = vi.fn();
    const r = await handleConsolidationEvaluate(
      { exerciseId: draftExerciseId, target: 'whole', answer: { type: 'essay', parts: { r1: 'a', r2: 'b' } } },
      userId,
      deps(evaluate),
    );
    expect(r.status).toBe(404);
    expect(evaluate).not.toHaveBeenCalled();
  });

  it('trips the per-user limit (30/hour) and consumed only prefixed keys', async () => {
    const answer = { type: 'essay', parts: { r1: 'a', r2: 'b' } };
    const limited = 'limited-user';
    const evaluate = vi.fn(async () => ({ items: [item('whole')] }));
    for (let i = 0; i < 30; i++) {
      const r = await handleConsolidationEvaluate({ exerciseId, target: 'whole', answer }, limited, deps(evaluate, unlimited));
      expect(r.status).toBe(200);
    }
    const r = await handleConsolidationEvaluate({ exerciseId, target: 'whole', answer }, limited, deps(evaluate, unlimited));
    expect(r.status).toBe(429);
    expect(evaluate).toHaveBeenCalledTimes(30);

    const { data } = await db.from('rate_limits').select('key').like('key', `${prefix}%`);
    expect(data!.map((x) => x.key).sort()).toEqual(
      [testKey(GLOBAL_RATE_KEY), testKey(`evaluate:user:${limited}`), testKey(`evaluate:user:${userId}`)].sort(),
    );
  });
});
