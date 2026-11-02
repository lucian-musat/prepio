import { config } from 'dotenv';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { handleEvaluate, type Deps } from './handler';
import { createRateLimit, GLOBAL_RATE_KEY, type RateLimit } from './rateLimit';

config({ path: [resolve(__dirname, '../../../.env.local'), resolve(__dirname, '../../../../../.env')], quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!url || !service)('handleEvaluate (local Supabase)', () => {
  let db: SupabaseClient;
  let nodeId: string;
  let lessonId: string;
  let exerciseId: string;
  // Every key the handler uses is rewritten under a unique prefix, so real quotas
  // (per-user and the shared `evaluate:global`) are never consumed by the tests.
  const prefix = `test-${randomUUID()}:`;
  const userId = 'user-under-test';
  let rateLimit: RateLimit;
  const testKey = (key: string) => `${prefix}${key}`;

  beforeAll(async () => {
    db = createClient(url!, service!, { auth: { persistSession: false } });
    const real = createRateLimit(db);
    rateLimit = (key, limit, windowSeconds) => real(testKey(key), limit, windowSeconds);
    const n = await db.from('nodes').insert({ title: '[test] evaluate' }).select('id').single();
    if (n.error) throw n.error;
    nodeId = n.data.id;
    const l = await db
      .from('lessons')
      .insert({ node_id: nodeId, title: '[test] evaluate', status: 'published' })
      .select('id')
      .single();
    if (l.error) throw l.error;
    lessonId = l.data.id;
    const e = await db
      .from('writing_exercises')
      .insert({ lesson_id: lessonId, prompt: 'P', criteria: 'C' })
      .select('id')
      .single();
    if (e.error) throw e.error;
    exerciseId = e.data.id;
  });

  afterAll(async () => {
    if (nodeId) await db.from('nodes').delete().eq('id', nodeId);
    await db.from('rate_limits').delete().like('key', `${prefix}%`);
  });

  const deps = (): Deps => ({
    db,
    rateLimit,
    evaluate: vi.fn(async () => ({ grade: 6, summary: 'ok', suggestions: ['x'] })),
  });

  it('serves a published exercise and trips the per-user rate limit on the 11th call', async () => {
    for (let i = 0; i < 10; i++) {
      const r = await handleEvaluate({ exerciseId, text: 'Un text.' }, userId, deps());
      expect(r.status).toBe(200);
    }
    const d = deps();
    const r = await handleEvaluate({ exerciseId, text: 'Un text.' }, userId, d);
    expect(r.status).toBe(429);
    expect(d.evaluate).not.toHaveBeenCalled();

    const { data } = await db.from('rate_limits').select('count').eq('key', testKey(GLOBAL_RATE_KEY)).single();
    expect(data?.count).toBe(10);
  });

  it('stops every caller once the global daily quota (300) is used up', async () => {
    const upd = await db
      .from('rate_limits')
      .update({ count: 300 })
      .eq('key', testKey(GLOBAL_RATE_KEY))
      .select('key');
    expect(upd.error).toBeNull();
    expect(upd.data).toHaveLength(1);

    const d = deps();
    const r = await handleEvaluate({ exerciseId, text: 'Un text.' }, 'another-user', d);
    expect(r.status).toBe(429);
    expect(r.json).toEqual({
      error: 'rate_limited',
      message: 'Serviciul de evaluare este foarte solicitat azi. Încearcă din nou mâine.',
    });
    expect(d.evaluate).not.toHaveBeenCalled();
  });

  it('consumed only the prefixed test keys (per-user keys plus the global key)', async () => {
    const { data } = await db.from('rate_limits').select('key').like('key', `${prefix}%`);
    expect(data!.map((r) => r.key).sort()).toEqual(
      [testKey(GLOBAL_RATE_KEY), testKey('evaluate:user:another-user'), testKey(`evaluate:user:${userId}`)].sort(),
    );
  });
});
