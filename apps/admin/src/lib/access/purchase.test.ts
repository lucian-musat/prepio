import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { handleAccessPurchase } from './purchase';

const USER = '22222222-2222-4222-8222-222222222222';
const OK_BODY = { expectedPriceBani: 15000, expectedBonusCredits: 100, expectedDurationMonths: 3 };

function fakeDb(result: { data?: unknown; error?: { message: string; code?: string } | null }, opts: { suspended?: boolean; settingsError?: boolean } = {}) {
  const rpc = vi.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null });
  const from = vi.fn((table: string) => {
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => ({ data: { suspended_at: opts.suspended ? '2026-11-06T10:00:00Z' : null }, error: null }),
      single: async () =>
        opts.settingsError || table !== 'access_settings'
          ? { data: null, error: { message: 'down' } }
          : { data: { price_bani: 20000, bonus_credits: 50, duration_months: 6 }, error: null },
    };
    return query;
  });
  return { db: { rpc, from } as unknown as SupabaseClient, rpc, from };
}

describe('handleAccessPurchase', () => {
  it.each([
    [null],
    [{}],
    [{ ...OK_BODY, expectedPriceBani: 1.5 }],
    [{ ...OK_BODY, expectedBonusCredits: -1 }],
    [{ ...OK_BODY, expectedDurationMonths: '3' }],
    [{ expectedPriceBani: 15000, expectedBonusCredits: 100 }],
    [{ ...OK_BODY, expectedPriceBani: Number.MAX_SAFE_INTEGER + 2 }],
  ])('rejects bad body %j with 400 and no RPC', async (body) => {
    const { db, rpc } = fakeDb({});
    const r = await handleAccessPurchase(body, USER, db);
    expect(r.status).toBe(400);
    expect(r.json).toEqual({ error: 'bad_request', message: 'Cererea nu este validă.' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('a suspended student gets 403 and no RPC', async () => {
    const { db, rpc } = fakeDb({}, { suspended: true });
    const r = await handleAccessPurchase(OK_BODY, USER, db);
    expect(r).toEqual({ status: 403, json: { error: 'suspended', message: 'Contul tău este suspendat.' } });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('offer_changed → 409 with the current offer read from access_settings', async () => {
    const { db, from } = fakeDb({ error: { message: 'offer_changed', code: 'P0001' } });
    const r = await handleAccessPurchase(OK_BODY, USER, db);
    expect(r).toEqual({
      status: 409,
      json: {
        error: 'offer_changed',
        message: 'Oferta s-a schimbat. Verifică noul preț.',
        offer: { priceBani: 20000, bonusCredits: 50, durationMonths: 6 },
      },
    });
    expect(from).toHaveBeenCalledWith('access_settings');
  });

  it('offer_changed with an unreadable offer is a 500', async () => {
    const { db } = fakeDb({ error: { message: 'offer_changed' } }, { settingsError: true });
    const r = await handleAccessPurchase(OK_BODY, USER, db);
    expect(r.status).toBe(500);
  });

  it('other RPC errors → 500', async () => {
    const { db } = fakeDb({ error: { message: 'profile_not_found' } });
    const r = await handleAccessPurchase(OK_BODY, USER, db);
    expect(r).toEqual({ status: 500, json: { error: 'server_error', message: 'Plata nu a reușit. Încearcă din nou.' } });
  });

  it('an empty result → 500', async () => {
    const { db } = fakeDb({ data: [] });
    expect((await handleAccessPurchase(OK_BODY, USER, db)).status).toBe(500);
  });

  it('success maps the row and passes the expected values to the RPC', async () => {
    const { db, rpc } = fakeDb({ data: [{ order_id: 'o1', access_until: '2027-02-08T10:00:00Z', bonus: 100, balance: 112 }] });
    const r = await handleAccessPurchase(OK_BODY, USER, db);
    expect(r).toEqual({ status: 200, json: { orderId: 'o1', accessUntil: '2027-02-08T10:00:00Z', bonus: 100, balance: 112 } });
    expect(rpc).toHaveBeenCalledWith('purchase_access', { p_user: USER, p_price_bani: 15000, p_bonus: 100, p_months: 3 });
  });
});
