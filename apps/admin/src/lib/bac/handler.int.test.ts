import { config } from 'dotenv';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { BacSubmitResponse } from '@prepio/shared';
import { createRateLimit, type RateLimit } from '@/lib/evaluate/rateLimit';
import { createCredits, type Credits } from '@/lib/credits/credits';
import type { Grader } from '@/lib/evaluate/openai';
import { createBacCharge, type BacCharge } from './charge';
import { BAC_RATE_KEY, bacUserRateKey, handleBacSubmit, type BacDeps } from './handler';

config({ path: [resolve(__dirname, '../../../.env.local'), resolve(__dirname, '../../../../../.env')], quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COST = 5;

describe.skipIf(!url || !service)('handleBacSubmit (local Supabase)', () => {
  let db: SupabaseClient;
  let subjectId: string;
  let shortId: string;
  let argId: string;
  // A real student with full access (welcome grant: 12 credits), so spend_credits / refund_credits run for real.
  let userId: string;
  let credits: Credits;
  let rateLimit: RateLimit;
  // Every rate-limit key is rewritten under a unique prefix, so real quotas are never consumed.
  const prefix = `test-${randomUUID()}:`;

  beforeAll(async () => {
    db = createClient(url!, service!, { auth: { persistSession: false } });
    const real = createRateLimit(db);
    rateLimit = (key, limit, windowSeconds) => real(`${prefix}${key}`, limit, windowSeconds);
    credits = createCredits(db);
    const u = await db.auth.admin.createUser({ email: `test-bac-${randomUUID()}@prepio.local`, password: 'test-password-123', email_confirm: true });
    if (u.error) throw u.error;
    userId = u.data.user.id;
    const paid = await db.from('profiles').update({ access_until: new Date(Date.now() + 86_400_000).toISOString() }).eq('id', userId);
    if (paid.error) throw paid.error;

    const s = await db
      .from('bac_subjects')
      .insert({ title: '[test] BAC submit', year: 2026, variant: '[test]', credit_cost: COST, published: true })
      .select('id')
      .single();
    if (s.error) throw s.error;
    subjectId = s.data.id;
    const items = await db
      .from('bac_items')
      .insert([
        { subject_id: subjectId, section: 1, position: 0, type: 'short_answer', prompt: '[test] Numiți domnitorul.', content: { accepted: ['Carol I'], mistakes: [] }, points: 6 },
        { subject_id: subjectId, section: 2, position: 0, type: 'argument', prompt: '[test] Argumentați afirmația.', content: {}, points: 10 },
      ])
      .select('id,type');
    if (items.error) throw items.error;
    shortId = items.data.find((i) => i.type === 'short_answer')!.id;
    argId = items.data.find((i) => i.type === 'argument')!.id;
    const barem = await db.from('bac_item_barem').insert([
      { item_id: shortId, barem: { text: '[test] BAREM scurt', points: 6, steps: null, essay: null } },
      { item_id: argId, barem: { text: '[test] BAREM argument', points: 10, steps: null, essay: null } },
    ]);
    if (barem.error) throw barem.error;
  });

  afterAll(async () => {
    if (userId) await db.auth.admin.deleteUser(userId); // attempts, ledger rows and events go with it
    if (subjectId) {
      await db.from('bac_items').delete().eq('subject_id', subjectId); // barem rows go with them
      await db.from('bac_subjects').delete().eq('id', subjectId);
    }
    await db.from('rate_limits').delete().like('key', `${prefix}%`);
  });

  const deps = (grade: Grader, charge: BacCharge = createBacCharge(db)): BacDeps => ({ db, rateLimit, credits, charge, grade });
  const counts = async () => {
    const { data, error } = await db.from('rate_limits').select('key,count').like('key', `${prefix}%`).order('key');
    if (error) throw error;
    return data;
  };
  const body = () => ({
    subjectId,
    answers: { [shortId]: { type: 'short_answer', text: 'Carol I' }, [argId]: { type: 'argument', text: 'Deoarece statul s-a modernizat.' } },
  });
  const balance = async () => {
    const { data, error } = await db.from('profiles').select('credit_balance').eq('id', userId).single();
    if (error) throw error;
    return data.credit_balance as number;
  };
  const attempts = async () => {
    const { data, error } = await db.from('bac_attempts').select('id,status,points,grade,results,ledger_entry').eq('user_id', userId).order('created_at');
    if (error) throw error;
    return data;
  };
  const events = async () => {
    const { data, error } = await db.from('student_events').select('kind,details').eq('user_id', userId).like('kind', 'bac_%').order('id');
    if (error) throw error;
    return data;
  };

  it('spends the cost once, grades the attempt and logs the events', async () => {
    const before = await balance();
    const grade = vi.fn<Grader>(async () => ({ points: 4, feedback: '' }));
    const r = await handleBacSubmit(body(), userId, deps(grade));
    expect(r.status).toBe(200);
    const json = r.json as BacSubmitResponse;
    expect(json).toMatchObject({ points: 10, grade: 2, credits: { spent: COST, balance: before - COST } });
    expect(grade).toHaveBeenCalledTimes(1);
    expect(await balance()).toBe(before - COST);
    const [a] = await attempts();
    expect(a).toMatchObject({ id: json.attemptId, status: 'graded', points: 10, grade: 2 });
    expect(a!.ledger_entry).not.toBeNull();
    expect(JSON.stringify(a!.results)).not.toContain('BAREM');
    const ledger = await db.from('credit_ledger').select('kind,delta,exercise_id,target').eq('id', a!.ledger_entry).single();
    expect(ledger.data).toEqual({ kind: 'check', delta: -COST, exercise_id: null, target: `bac:${subjectId}` });
    expect(await events()).toEqual([
      { kind: 'bac_submitted', details: { subject_id: subjectId, cost: COST } },
      { kind: 'bac_graded', details: { subject_id: subjectId, points: 10, grade: 2 } },
    ]);
  });

  it('restores the balance and fails the attempt when the grader throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const before = await balance();
    const r = await handleBacSubmit(body(), userId, deps(async () => {
      throw new Error('boom');
    }));
    expect(r.status).toBe(502);
    expect(r.json).toMatchObject({ error: 'grading_failed', credits: { spent: 0, balance: before } });
    expect(await balance()).toBe(before);
    const all = await attempts();
    expect(all).toHaveLength(2);
    expect(all[1]).toMatchObject({ status: 'failed', points: null, results: null });
    expect((await events()).at(-1)).toEqual({ kind: 'bac_grading_failed', details: { subject_id: subjectId } });
  });

  it('refunds a charge that committed when its response was lost', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const before = await balance();
    const real = createBacCharge(db);
    const lost: BacCharge = async (...args) => {
      await real(...args);
      throw new Error('fetch failed');
    };
    const grade = vi.fn<Grader>(async () => ({ points: 4, feedback: '' }));
    const r = await handleBacSubmit(body(), userId, deps(grade, lost));
    expect(r.status).toBe(502);
    expect(r.json).toMatchObject({ error: 'grading_failed', credits: { spent: 0, balance: before } });
    expect(grade).not.toHaveBeenCalled();
    expect(await balance()).toBe(before);
    const all = await attempts();
    expect(all).toHaveLength(2); // the failed attempt was reused
    expect(all[1]!.status).toBe('failed');
    expect(all[1]!.ledger_entry).not.toBeNull();
    const refund = await db.from('credit_ledger').select('kind').eq('refund_of', all[1]!.ledger_entry).single();
    expect(refund.data).toEqual({ kind: 'refund' });
  });

  it('grades the reopened failed attempt; a concurrent second submit gets already_grading', async () => {
    const before = await balance();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let started!: () => void;
    const inGrading = new Promise<void>((r) => (started = r));
    const slow = vi.fn<Grader>(async () => {
      started();
      await gate;
      return { points: 10, feedback: '' };
    });
    const first = handleBacSubmit(body(), userId, deps(slow));
    await inGrading;
    const second = await handleBacSubmit(body(), userId, deps(slow));
    expect(second.status).toBe(409);
    release();
    const r = await first;
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ points: 16, credits: { spent: COST, balance: before - COST } });
    expect(await balance()).toBe(before - COST);
    const all = await attempts();
    expect(all).toHaveLength(2); // the failed attempt was reused, not duplicated
    expect(all[1]).toMatchObject({ status: 'graded', points: 16 });

    // Four papers reached the rate limits (the 409 stopped at the pre-check), per user and globally.
    expect(await counts()).toEqual([
      { key: `${prefix}${BAC_RATE_KEY}`, count: 4 },
      { key: `${prefix}${bacUserRateKey(userId)}`, count: 4 },
    ]);
  });

  it('answers 402 from the balance pre-check without consuming a rate-limit slot', async () => {
    const before = await balance();
    expect(before).toBeLessThan(COST);
    const slots = await counts();
    const r = await handleBacSubmit(body(), userId, deps(vi.fn<Grader>()));
    expect(r.status).toBe(402);
    expect(r.json).toMatchObject({ error: 'insufficient_credits', required: COST, balance: before });
    expect(await counts()).toEqual(slots);
    expect(await balance()).toBe(before);
  });
});
