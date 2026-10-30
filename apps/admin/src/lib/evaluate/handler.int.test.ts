import { config } from 'dotenv';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { handleEvaluate, type Deps } from './handler';
import { createRateLimit } from './rateLimit';

config({ path: [resolve(__dirname, '../../../.env.local'), resolve(__dirname, '../../../../../.env')], quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!url || !service)('handleEvaluate (local Supabase)', () => {
  let db: SupabaseClient;
  let nodeId: string;
  let lessonId: string;
  let exerciseId: string;
  const ip = `test-${randomUUID()}`;

  beforeAll(async () => {
    db = createClient(url!, service!, { auth: { persistSession: false } });
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
    await db.from('rate_limits').delete().eq('key', `evaluate:${ip}`);
  });

  it('serves a published exercise and trips the rate limit on the 11th call', async () => {
    const deps = (): Deps => ({
      db,
      rateLimit: createRateLimit(db),
      evaluate: vi.fn(async () => ({ grade: 6, summary: 'ok', suggestions: ['x'] })),
    });
    for (let i = 0; i < 10; i++) {
      const r = await handleEvaluate({ exerciseId, text: 'Un text.' }, ip, deps());
      expect(r.status).toBe(200);
    }
    const d = deps();
    const r = await handleEvaluate({ exerciseId, text: 'Un text.' }, ip, d);
    expect(r.status).toBe(429);
    expect(d.evaluate).not.toHaveBeenCalled();
  });
});
