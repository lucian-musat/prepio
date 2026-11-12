import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

config({ path: [resolve(__dirname, '../../../.env.local'), resolve(__dirname, '../../../../../.env')], quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ADMIN_EMAIL ?? 'admin@prepio.local';
const password = process.env.ADMIN_PASSWORD ?? 'prepio-local-admin';

type ReferralSettings = { enabled: boolean; threshold: number; credits_per_invitee: number; max_rewarded: number };
type Offer = { price_bani: number; bonus_credits: number; duration_months: number };

const ROUNDS = 20;

// Concurrency of the reward engine inside purchase_access: in every round a chain C -> A -> B (C invited A, A invited
// B) buys at the same time, B twice. A locks A then C, B locks B then A, C locks only C: whatever the order, there is
// no deadlock and every referral ends converted to credits exactly once.
describe.skipIf(!url || !anon || !serviceKey)('referral rewards under concurrent purchases (local Supabase)', () => {
  let db: SupabaseClient;
  let service: SupabaseClient;
  let original: ReferralSettings | undefined;
  let offer: Offer;
  const users: string[] = [];

  const newUser = async (tag: string) => {
    const e = `test-ref-${tag}-${Math.random().toString(36).slice(2, 10)}@test.local`;
    const created = await service.auth.admin.createUser({ email: e, email_confirm: true });
    if (created.error) throw created.error;
    users.push(created.data.user.id);
    return created.data.user.id;
  };

  const buy = (user: string) =>
    service.rpc('purchase_access', {
      p_user: user, p_price_bani: offer.price_bani, p_bonus: offer.bonus_credits, p_months: offer.duration_months,
    });

  const saveSettings = async (s: ReferralSettings) => {
    const { error } = await db.rpc('admin_save_referral_settings', {
      p_enabled: s.enabled, p_threshold: s.threshold, p_credits: s.credits_per_invitee, p_max: s.max_rewarded,
    });
    if (error) throw error;
  };

  beforeAll(async () => {
    db = createClient(url!, anon!, { auth: { persistSession: false } });
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    service = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });

    const settings = await service.from('referral_settings').select('enabled, threshold, credits_per_invitee, max_rewarded').eq('id', 1).single();
    if (settings.error) throw settings.error;
    original = settings.data;
    const o = await service.from('access_settings').select('price_bani, bonus_credits, duration_months').eq('id', 1).single();
    if (o.error) throw o.error;
    offer = o.data;
    await saveSettings({ enabled: true, threshold: 5, credits_per_invitee: 40, max_rewarded: 100 });
  });

  afterAll(async () => {
    if (original) await saveSettings(original);
    for (const id of users) await service.auth.admin.deleteUser(id);
  });

  it(`runs ${ROUNDS} rounds of simultaneous inviter and invitee purchases without errors`, async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const c = await newUser('c');
      const a = await newUser('a');
      const b = await newUser('b');
      const ins = await service.from('referrals').insert([
        { inviter_id: c, invitee_id: a },
        { inviter_id: a, invitee_id: b },
      ]);
      if (ins.error) throw ins.error;

      const results = await Promise.all([buy(a), buy(b), buy(c), buy(b)]);
      for (const r of results) expect(r.error, `round ${round}: ${r.error?.message}`).toBeNull();

      const refs = await service.from('referrals')
        .select('id, inviter_id, invitee_id, state, reward_credits, credit_ledger_id, first_paid_at')
        .in('invitee_id', [a, b]);
      if (refs.error) throw refs.error;
      expect(refs.data).toHaveLength(2);
      for (const r of refs.data) {
        expect(r, `round ${round}`).toMatchObject({ state: 'converted_credits', reward_credits: 40 });
        expect(r.first_paid_at).not.toBeNull();
        expect(r.credit_ledger_id).not.toBeNull();
      }

      for (const inviter of [c, a]) {
        const ledger = await service.from('credit_ledger').select('id, delta, referral_id').eq('user_id', inviter).eq('kind', 'referral');
        if (ledger.error) throw ledger.error;
        expect(ledger.data, `round ${round}: inviter credit rows`).toHaveLength(1);
        expect(ledger.data[0].delta).toBe(40);
        expect(refs.data.find((r) => r.id === ledger.data[0].referral_id)?.inviter_id).toBe(inviter);

        const events = await service.from('student_events').select('id', { count: 'exact', head: true })
          .eq('user_id', inviter).eq('kind', 'referral_credits');
        expect(events.count, `round ${round}: referral_credits events`).toBe(1);

        const grants = await service.from('access_ledger').select('id', { count: 'exact', head: true })
          .eq('user_id', inviter).eq('kind', 'referral_reward');
        expect(grants.count).toBe(0);
      }

      const orders = await service.from('access_orders').select('id', { count: 'exact', head: true })
        .eq('user_id', b).eq('status', 'approved');
      expect(orders.count, `round ${round}: invitee orders`).toBe(2);

      // The balance matches the ledger for every account of the round.
      for (const u of [a, b, c]) {
        const p = await service.from('profiles').select('credit_balance').eq('id', u).single();
        const l = await service.from('credit_ledger').select('delta').eq('user_id', u);
        if (p.error || l.error) throw p.error ?? l.error;
        expect(p.data.credit_balance).toBe(l.data.reduce((s, x) => s + x.delta, 0));
      }
    }
  });
});
