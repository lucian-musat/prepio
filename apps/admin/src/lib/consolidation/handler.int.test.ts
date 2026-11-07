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

  // `[test]` AI templates, created here (seed exercises get their links in the content step).
  const templateIds: string[] = [];
  let tplR1: string;
  let tplR2: string;
  let tplWrong: string;
  async function insertTemplate(type: string, criteria: string): Promise<string> {
    const t = await db
      .from('ai_templates')
      .insert({ title: `[test] evaluate ${criteria}`, type, criteria, keywords: '', response_format: '' })
      .select('id')
      .single();
    if (t.error) throw t.error;
    templateIds.push(t.data.id);
    return t.data.id;
  }

  /** `links`: requirement id → template id; defaults to the right essay templates. */
  async function insertExercise(lesson: string, creditCost = 1, links: Record<string, string> = { r1: tplR1, r2: tplR2 }): Promise<string> {
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
    const rows = Object.entries(links).map(([requirement_id, template_id]) => ({ exercise_id: e.data.id, requirement_id, template_id }));
    if (rows.length) {
      const k = await db.from('consolidation_ai_template_links').insert(rows);
      if (k.error) throw k.error;
    }
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
    tplR1 = await insertTemplate('essay_requirement', 'CRITERII-R1');
    tplR2 = await insertTemplate('essay_requirement', 'CRITERII-R2');
    tplWrong = await insertTemplate('argument', 'CRITERII-ARG');
    exerciseId = await insertExercise(lessonId);
    draftExerciseId = await insertExercise(draftLessonId);
  });

  afterAll(async () => {
    if (userId) await db.auth.admin.deleteUser(userId); // the ledger rows go with it
    if (nodeId) await db.from('nodes').delete().eq('id', nodeId); // the exercises and their template links go with it
    if (templateIds.length) await db.from('ai_templates').delete().in('id', templateIds);
    await db.from('rate_limits').delete().like('key', `${prefix}%`);
  });

  const deps = (evaluate: Deps['evaluate'], c: Credits = credits): Deps => ({ db, rateLimit, evaluate, credits: c });
  /** For the profile-less rate-limit user: never runs out. */
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

  it('evaluates one requirement, sending the DB context, its AI template and connector facts', async () => {
    const evaluate = vi.fn<Deps['evaluate']>(async () => ({ items: [item('r1')] }));
    const r = await handleConsolidationEvaluate(
      { exerciseId, target: { requirementId: 'r1' }, answer: { type: 'essay', parts: { r1: 'Deoarece da. Deci așa.', r2: '' } } },
      userId,
      deps(evaluate),
    );
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ items: [{ ...item('r1'), ai: true }], credits: { spent: 1, balance: 11 } });
    expect(await balance()).toBe(11);
    expect((await ledger()).at(-1)).toMatchObject({ kind: 'check', delta: -1, balance_after: 11, exercise_id: exerciseId, target: 'req:r1' });
    const { input, instructions } = evaluate.mock.calls[0]![0] as { input: string; instructions: string };
    expect(input).toContain('CTX-UNU');
    expect(input).not.toContain('CTX-DOI');
    expect(input).toContain('cauzalitate da, concluzie da');
    expect(instructions).toContain('Ce urmărești în răspuns:\nCRITERII-R1');
    expect(instructions).not.toContain('CRITERII-R2');
  });

  it('rejects whole with bad_request; nothing is spent', async () => {
    const evaluate = vi.fn();
    const before = (await ledger()).length;
    const r = await handleConsolidationEvaluate(
      { exerciseId, target: 'whole', answer: { type: 'essay', parts: { r1: 'Text unu', r2: 'Text doi' } } }, userId, deps(evaluate),
    );
    expect(r.status).toBe(400);
    expect(r.json).toMatchObject({ error: 'bad_request' });
    expect(evaluate).not.toHaveBeenCalled();
    expect(await balance()).toBe(11);
    expect(await ledger()).toHaveLength(before);
  });

  it('answers not_found without spending when the AI template link is missing or of the wrong type', async () => {
    const unlinked = await insertExercise(lessonId, 1, { r1: tplR1 }); // r2 has no template
    const wrong = await insertExercise(lessonId, 1, { r1: tplWrong, r2: tplR2 });
    const evaluate = vi.fn();
    const before = (await ledger()).length;
    for (const id of [unlinked, wrong]) {
      const r = await handleConsolidationEvaluate(
        { exerciseId: id, target: { requirementId: 'r1' }, answer: { type: 'essay', parts: { r1: 'a', r2: 'b' } } }, userId, deps(evaluate),
      );
      expect(r.status, id).toBe(404);
      expect(r.json).toMatchObject({ error: 'not_found' });
    }
    expect(evaluate).not.toHaveBeenCalled();
    expect(await balance()).toBe(11);
    expect(await ledger()).toHaveLength(before);
  });

  it('answers not_found without spending when another requirement has a template of the wrong type', async () => {
    const tplFacts = await insertTemplate('facts', 'CRITERII-FACTS');
    const mixed = await insertExercise(lessonId, 1, { r1: tplR1, r2: tplFacts });
    const evaluate = vi.fn();
    const before = (await ledger()).length;
    const r = await handleConsolidationEvaluate(
      { exerciseId: mixed, target: { requirementId: 'r1' }, answer: { type: 'essay', parts: { r1: 'a', r2: 'b' } } }, userId, deps(evaluate),
    );
    expect(r.status).toBe(404);
    expect(r.json).toMatchObject({ error: 'not_found' });
    expect(evaluate).not.toHaveBeenCalled();
    expect(await balance()).toBe(11);
    expect(await ledger()).toHaveLength(before);
  });

  it('gives the credits back when the evaluation fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const evaluate = vi.fn(async () => {
      throw new Error('boom');
    });
    const r = await handleConsolidationEvaluate(
      { exerciseId, target: { requirementId: 'r2' }, answer: { type: 'essay', parts: { r1: 'a', r2: 'b' } } }, userId, deps(evaluate),
    );
    expect(r.status).toBe(502);
    expect(r.json).toEqual({
      error: 'ai_failed', message: 'Verificarea nu a reușit. Nu ți-am luat niciun credit. Încearcă din nou.', credits: { spent: 0, balance: 11 },
    });
    expect(await balance()).toBe(11);
    const [check, refund] = (await ledger()).slice(-2);
    expect(check).toMatchObject({ kind: 'check', delta: -1, target: 'req:r2' });
    expect(refund).toMatchObject({ kind: 'refund', delta: 1, balance_after: 11, refund_of: check!.id });
  });

  it('refuses a check the balance cannot cover, without calling the evaluator', async () => {
    const pricey = await insertExercise(lessonId, 5);
    // credit_cost is capped at 5: bring the balance down from 11 to 4 with a real check entry first.
    const drained = await credits.spend(userId, 7, exerciseId, 'req:r1');
    expect(drained).toMatchObject({ balance: 4 });
    const evaluate = vi.fn();
    const before = (await ledger()).length;
    const r = await handleConsolidationEvaluate(
      { exerciseId: pricey, target: { requirementId: 'r1' }, answer: { type: 'essay', parts: { r1: 'a', r2: 'b' } } }, userId, deps(evaluate),
    );
    expect(r.status).toBe(402);
    expect(r.json).toEqual({
      error: 'insufficient_credits', message: 'Nu ai destule credite pentru această verificare.', required: 5, balance: 4,
    });
    expect(evaluate).not.toHaveBeenCalled();
    expect(await balance()).toBe(4);
    expect(await ledger()).toHaveLength(before);
    const ev = await db.from('student_events').select('kind,exercise_id,details').eq('user_id', userId).eq('kind', 'check_blocked');
    expect(ev.error).toBeNull();
    expect(ev.data).toEqual([{ kind: 'check_blocked', exercise_id: pricey, details: { required: 5, balance: 4 } }]);
  });

  it('refuses a suspended student with 403 before anything is spent', async () => {
    const evaluate = vi.fn();
    const before = await balance();
    const upd = await db.from('profiles').update({ suspended_at: new Date().toISOString(), suspended_reason: '[test] Spam' }).eq('id', userId);
    if (upd.error) throw upd.error;
    try {
      const r = await handleConsolidationEvaluate(
        { exerciseId, target: { requirementId: 'r1' }, answer: { type: 'essay', parts: { r1: 'a' } } }, userId, deps(evaluate),
      );
      expect(r).toEqual({ status: 403, json: { error: 'suspended', message: 'Contul tău este suspendat.' } });
      expect(evaluate).not.toHaveBeenCalled();
      expect(await balance()).toBe(before);
    } finally {
      const back = await db.from('profiles').update({ suspended_at: null, suspended_reason: null }).eq('id', userId);
      if (back.error) throw back.error;
    }
  });

  it('does not serve an exercise of an unpublished lesson', async () => {
    const evaluate = vi.fn();
    const r = await handleConsolidationEvaluate(
      { exerciseId: draftExerciseId, target: { requirementId: 'r1' }, answer: { type: 'essay', parts: { r1: 'a', r2: 'b' } } },
      userId,
      deps(evaluate),
    );
    expect(r.status).toBe(404);
    expect(evaluate).not.toHaveBeenCalled();
  });

  it('has no per-user hourly limit and consumes only the prefixed global key', async () => {
    const answer = { type: 'essay', parts: { r1: 'a', r2: 'b' } };
    const busy = randomUUID(); // no profile, so not suspended; `unlimited` never touches the ledger
    const evaluate = vi.fn(async () => ({ items: [item('r1')] }));
    for (let i = 0; i < 31; i++) {
      const r = await handleConsolidationEvaluate({ exerciseId, target: { requirementId: 'r1' }, answer }, busy, deps(evaluate, unlimited));
      expect(r.status).toBe(200);
    }
    expect(evaluate).toHaveBeenCalledTimes(31);

    const { data } = await db.from('rate_limits').select('key').like('key', `${prefix}%`);
    expect(data!.map((x) => x.key)).toEqual([testKey(GLOBAL_RATE_KEY)]);
  });
});
