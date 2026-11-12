import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { accessSource, getStudentReferrals } from './referrals';
import { getStudent } from './students';

config({ path: [resolve(__dirname, '../../../.env.local'), resolve(__dirname, '../../../../../.env')], quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@prepio.local';
const adminPassword = process.env.ADMIN_PASSWORD ?? 'prepio-local-admin';

type Settings = { enabled: boolean; threshold: number; credits_per_invitee: number; max_rewarded: number };

describe.skipIf(!url || !anon || !serviceKey)('student referrals data functions (local Supabase)', () => {
  let db: SupabaseClient;
  let service: SupabaseClient;
  let original: Settings | undefined;
  const users: string[] = [];
  const tag = Math.random().toString(36).slice(2, 10);
  const pw = 'test-password-123';
  let inviter: string;
  let invitee: string;

  const save = async (s: Settings) => {
    const { error } = await db.rpc('admin_save_referral_settings', {
      p_enabled: s.enabled, p_threshold: s.threshold, p_credits: s.credits_per_invitee, p_max: s.max_rewarded,
    });
    if (error) throw error;
  };
  const newUser = async (name: string) => {
    const created = await service.auth.admin.createUser({ email: `test-ref9-${name}-${tag}@test.local`, password: pw, email_confirm: true });
    if (created.error) throw created.error;
    users.push(created.data.user.id);
    return created.data.user.id;
  };

  beforeAll(async () => {
    db = createClient(url!, anon!, { auth: { persistSession: false } });
    const { error } = await db.auth.signInWithPassword({ email: adminEmail, password: adminPassword });
    if (error) throw error;
    service = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    const s = await service.from('referral_settings').select('enabled, threshold, credits_per_invitee, max_rewarded').eq('id', 1).single();
    if (s.error) throw s.error;
    original = s.data;
    await save({ enabled: true, threshold: 1, credits_per_invitee: 40, max_rewarded: 100 });

    inviter = await newUser('inviter');
    invitee = await newUser('invitee');
    // The inviter's profile must be strictly older than the invitee's for the referral to attach.
    const old = await service.from('profiles').update({ created_at: new Date(Date.now() - 2 * 86_400_000).toISOString() }).eq('id', inviter);
    if (old.error) throw old.error;
  });

  afterAll(async () => {
    if (original) await save(original);
    for (const id of users) await service.auth.admin.deleteUser(id);
  });

  it('lists the invitee as registered, then shows the reward and its access source after the purchase', async () => {
    const code = await service.from('referral_codes').select('code').eq('user_id', inviter).single();
    if (code.error) throw code.error;

    const inviteeDb = createClient(url!, anon!, { auth: { persistSession: false } });
    const signIn = await inviteeDb.auth.signInWithPassword({ email: `test-ref9-invitee-${tag}@test.local`, password: pw });
    if (signIn.error) throw signIn.error;
    const attached = await inviteeDb.rpc('referral_attach', { p_code: code.data.code });
    expect(attached.error).toBeNull();
    expect(attached.data).toBe('attached');

    let r = await getStudentReferrals(db, inviter);
    expect(r.code).toBe(code.data.code);
    expect(r.invitedBy).toBeNull();
    expect(r.invitees).toHaveLength(1);
    expect(r.invitees[0]).toMatchObject({
      state: 'registered', email: `test-ref9-invitee-${tag}@test.local`, accountDeleted: false, firstPaidAt: null,
    });
    const asInvitee = await getStudentReferrals(db, invitee);
    expect(asInvitee.invitedBy?.id).toBe(inviter);
    expect(asInvitee.invitees).toEqual([]);

    const offer = await service.from('access_settings').select('price_bani, bonus_credits, duration_months').eq('id', 1).single();
    if (offer.error) throw offer.error;
    const bought = await service.rpc('purchase_access', {
      p_user: invitee, p_price_bani: offer.data.price_bani, p_bonus: offer.data.bonus_credits, p_months: offer.data.duration_months,
    });
    expect(bought.error).toBeNull();

    r = await getStudentReferrals(db, inviter);
    expect(r.invitees[0].state).toBe('consumed_access');
    expect(r.invitees[0].firstPaidAt).not.toBeNull();

    const got = await getStudent(db, inviter);
    expect(got!.student.accessUntil).not.toBeNull();
    expect(accessSource(r.accessEntries, got!.student.accessUntil, new Date())).toMatchObject({ kind: 'referral_reward' });
    // The invitee bought it themselves.
    const inv = await getStudent(db, invitee);
    const invRefs = await getStudentReferrals(db, invitee);
    expect(accessSource(invRefs.accessEntries, inv!.student.accessUntil, new Date()).kind).toBe('purchase');
  });
});
