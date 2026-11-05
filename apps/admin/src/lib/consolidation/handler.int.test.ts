import { config } from 'dotenv';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { handleConsolidationEvaluate, type Deps } from './handler';
import { createRateLimit, GLOBAL_RATE_KEY, type RateLimit } from '@/lib/evaluate/rateLimit';

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
  const userId = 'user-under-test';
  let rateLimit: RateLimit;
  const testKey = (key: string) => `${prefix}${key}`;
  const requirements = [
    { id: 'r1', text: '[test] Cerința 1', modelAnswer: null, templateId: null, argument: true },
    { id: 'r2', text: '[test] Cerința 2', modelAnswer: null, templateId: null, argument: false },
  ];

  async function insertExercise(lesson: string): Promise<string> {
    const e = await db
      .from('consolidation_exercises')
      .insert({ lesson_id: lesson, position: 0, type: 'essay', prompt: '[test] eseu', content: { requirements }, template_id: null })
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
    if (nodeId) await db.from('nodes').delete().eq('id', nodeId);
    await db.from('rate_limits').delete().like('key', `${prefix}%`);
  });

  const deps = (evaluate: Deps['evaluate']): Deps => ({ db, rateLimit, evaluate });
  const item = (key: string) => ({ key, verdict: 'almost', title: 'T', good: ['g'], improve: ['i'] });

  it('evaluates one requirement, sending the DB context and connector facts', async () => {
    const evaluate = vi.fn(async (_a: Parameters<Deps['evaluate']>[0]) => ({ items: [item('r1')] }));
    const r = await handleConsolidationEvaluate(
      { exerciseId, target: { requirementId: 'r1' }, answer: { type: 'essay', parts: { r1: 'Deoarece da. Deci așa.', r2: '' } } },
      userId,
      deps(evaluate),
    );
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ items: [{ ...item('r1'), ai: true }] });
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
    const { input } = evaluate.mock.calls[0]![0] as { input: string };
    expect(input).toContain('CTX-UNU');
    expect(input).toContain('CTX-DOI');

    const missing = { type: 'essay', parts: { r1: 'Text unu', r2: '' } };
    const e = await handleConsolidationEvaluate({ exerciseId, target: 'whole', answer: missing }, userId, deps(evaluate));
    expect(e.status).toBe(400);
    expect(e.json).toMatchObject({ error: 'empty' });
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
      const r = await handleConsolidationEvaluate({ exerciseId, target: 'whole', answer }, limited, deps(evaluate));
      expect(r.status).toBe(200);
    }
    const r = await handleConsolidationEvaluate({ exerciseId, target: 'whole', answer }, limited, deps(evaluate));
    expect(r.status).toBe(429);
    expect(evaluate).toHaveBeenCalledTimes(30);

    const { data } = await db.from('rate_limits').select('key').like('key', `${prefix}%`);
    expect(data!.map((x) => x.key).sort()).toEqual(
      [testKey(GLOBAL_RATE_KEY), testKey(`evaluate:user:${limited}`), testKey(`evaluate:user:${userId}`)].sort(),
    );
  });
});
