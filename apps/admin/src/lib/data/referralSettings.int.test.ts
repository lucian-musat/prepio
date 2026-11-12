import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { UserError } from './db';
import { getReferralSettings, saveReferralSettings, type ReferralSettings } from './referralSettings';

config({ path: [resolve(__dirname, '../../../.env.local'), resolve(__dirname, '../../../../../.env')], quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const email = process.env.ADMIN_EMAIL ?? 'admin@prepio.local';
const password = process.env.ADMIN_PASSWORD ?? 'prepio-local-admin';

describe.skipIf(!url || !anon)('referral settings data functions (local Supabase)', () => {
  let db: SupabaseClient;
  let original: ReferralSettings;

  beforeAll(async () => {
    db = createClient(url!, anon!, { auth: { persistSession: false } });
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    original = await getReferralSettings(db);
  });

  afterAll(async () => {
    if (original) await saveReferralSettings(db, original);
  });

  it('round-trips a save', async () => {
    const next = { enabled: !original.enabled, threshold: 7, creditsPerInvitee: 12, maxRewarded: 33 };
    await saveReferralSettings(db, next);
    expect(await getReferralSettings(db)).toEqual(next);
  });

  it('rejects out-of-range values client-side and saves nothing', async () => {
    const before = await getReferralSettings(db);
    await expect(saveReferralSettings(db, { ...before, threshold: 0 })).rejects.toBeInstanceOf(UserError);
    expect(await getReferralSettings(db)).toEqual(before);
  });

  it('the RPC rejects out-of-range values (23514)', async () => {
    const { error } = await db.rpc('admin_save_referral_settings', { p_enabled: true, p_threshold: 101, p_credits: 1, p_max: 1 });
    expect(error?.code).toBe('23514');
  });

  it('a non-admin caller cannot call the RPC (42501)', async () => {
    const anonDb = createClient(url!, anon!, { auth: { persistSession: false } });
    const { error } = await anonDb.rpc('admin_save_referral_settings', { p_enabled: true, p_threshold: 1, p_credits: 1, p_max: 1 });
    expect(error?.code).toBe('42501');
    await expect(saveReferralSettings(anonDb, original)).rejects.toBeInstanceOf(UserError);
  });
});
