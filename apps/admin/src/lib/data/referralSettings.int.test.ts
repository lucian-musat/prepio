import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { UserError } from './db';
import { getReferralSettings, saveReferralSettings, type ReferralSettings } from './referralSettings';

config({ path: [resolve(__dirname, '../../../.env.local'), resolve(__dirname, '../../../../../.env')], quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ADMIN_EMAIL ?? 'admin@prepio.local';
const password = process.env.ADMIN_PASSWORD ?? 'prepio-local-admin';

describe.skipIf(!url || !anon || !serviceKey)('referral settings data functions (local Supabase)', () => {
  let db: SupabaseClient;
  let service: SupabaseClient;
  let original: ReferralSettings;

  beforeAll(async () => {
    db = createClient(url!, anon!, { auth: { persistSession: false } });
    service = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
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

  it('a signed-in non-admin cannot call the RPC (forbidden, 42501) and nothing changes', async () => {
    const before = await getReferralSettings(db);
    const studentEmail = `test-referral-student-${randomUUID()}@prepio.local`;
    const studentPassword = 'test-password-123';
    const created = await service.auth.admin.createUser({ email: studentEmail, password: studentPassword, email_confirm: true });
    if (created.error) throw created.error;
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const studentDb = createClient(url!, anon!, { auth: { persistSession: false } });
      const signIn = await studentDb.auth.signInWithPassword({ email: studentEmail, password: studentPassword });
      if (signIn.error) throw signIn.error;
      const rpc = await studentDb.rpc('admin_save_referral_settings', { p_enabled: true, p_threshold: 1, p_credits: 1, p_max: 1 });
      expect(rpc.error?.code).toBe('42501');
      expect(rpc.error?.message).toBe('forbidden');
      await expect(saveReferralSettings(studentDb, { ...before, threshold: 9 })).rejects.toThrow('Nu ai permisiunea să modifici setările recomandărilor.');
      expect(await getReferralSettings(db)).toEqual(before);
    } finally {
      spy.mockRestore();
      await service.auth.admin.deleteUser(created.data.user!.id);
    }
  });

  it('an anonymous caller is also refused (execute revoked)', async () => {
    const anonDb = createClient(url!, anon!, { auth: { persistSession: false } });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { error } = await anonDb.rpc('admin_save_referral_settings', { p_enabled: true, p_threshold: 1, p_credits: 1, p_max: 1 });
      expect(error?.code).toBe('42501');
      await expect(saveReferralSettings(anonDb, original)).rejects.toBeInstanceOf(UserError);
    } finally {
      spy.mockRestore();
    }
  });
});
