import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { captureFailure } from '@/lib/sentry';
import { handleCreditsPurchase } from './purchase';

vi.mock('@/lib/sentry', () => ({ captureFailure: vi.fn() }));
const failure = vi.mocked(captureFailure);
beforeEach(() => failure.mockClear());

const PKG = '11111111-1111-4111-8111-111111111111';
const USER = '22222222-2222-4222-8222-222222222222';

function fakeDb(result: { data?: unknown; error?: { message: string; code?: string } | null }, suspended = false) {
  const rpc = vi.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null });
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: { suspended_at: suspended ? '2026-11-06T10:00:00Z' : null }, error: null }),
  };
  const from = vi.fn(() => query);
  return { db: { rpc, from } as unknown as SupabaseClient, rpc, from };
}

describe('handleCreditsPurchase', () => {
  it.each([[null], [{}], [{ packageId: 5 }], [{ packageId: 'nope' }]])('rejects bad body %j with 400 and no RPC', async (body) => {
    const { db, rpc } = fakeDb({});
    const r = await handleCreditsPurchase(body, USER, db);
    expect(r.status).toBe(400);
    expect(r.json).toEqual({ error: 'bad_request', message: 'Cererea nu este validă.' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each(['package_unavailable', 'package_not_found'])('maps %s to 409', async (message) => {
    const { db } = fakeDb({ error: { message, code: 'P0001' } });
    const r = await handleCreditsPurchase({ packageId: PKG }, USER, db);
    expect(r.status).toBe(409);
    expect(r.json).toEqual({ error: 'package_unavailable', message: 'Pachetul nu mai este disponibil. Alege altul.' });
  });

  it('maps other RPC errors to 500', async () => {
    const { db } = fakeDb({ error: { message: 'profile_not_found', code: 'P0001' } });
    const r = await handleCreditsPurchase({ packageId: PKG }, USER, db);
    expect(r.status).toBe(500);
    expect(r.json).toEqual({ error: 'server_error', message: 'Cumpărarea nu a reușit. Încearcă din nou.' });
    expect(failure).toHaveBeenCalledTimes(1);
    expect(failure).toHaveBeenCalledWith('credits/purchase', 'rpc', expect.objectContaining({ message: 'profile_not_found' }), 500);
  });

  it('maps an empty result to 500', async () => {
    const { db } = fakeDb({ data: [] });
    expect((await handleCreditsPurchase({ packageId: PKG }, USER, db)).status).toBe(500);
    expect(failure).toHaveBeenCalledTimes(1);
    expect(failure).toHaveBeenCalledWith('credits/purchase', 'rpc_empty', undefined, 500);
  });

  it('reports a failing suspension lookup as a 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { db, from } = fakeDb({});
    from.mockImplementation(() => {
      throw new Error('network down');
    });
    expect((await handleCreditsPurchase({ packageId: PKG }, USER, db)).status).toBe(500);
    expect(failure).toHaveBeenCalledTimes(1);
    expect(failure).toHaveBeenCalledWith('credits/purchase', 'suspension_lookup', expect.any(Error), 500);
  });

  it('reports nothing for expected outcomes', async () => {
    await handleCreditsPurchase({ packageId: PKG }, USER, fakeDb({ error: { message: 'package_unavailable' } }).db);
    await handleCreditsPurchase({ packageId: PKG }, USER, fakeDb({ data: [{ order_id: 'o1', credits: 50, balance: 62 }] }).db);
    expect(failure).not.toHaveBeenCalled();
  });

  it('returns the order on success', async () => {
    const { db, rpc } = fakeDb({ data: [{ order_id: 'o1', credits: 50, balance: 62 }] });
    const r = await handleCreditsPurchase({ packageId: PKG }, USER, db);
    expect(r).toEqual({ status: 200, json: { orderId: 'o1', credits: 50, balance: 62 } });
    expect(rpc).toHaveBeenCalledWith('purchase_credit_package', { p_user: USER, p_package: PKG });
  });

  it('refuses a suspended student with 403 and no purchase RPC', async () => {
    const { db, rpc, from } = fakeDb({ data: [{ order_id: 'o1', credits: 50, balance: 62 }] }, true);
    const r = await handleCreditsPurchase({ packageId: PKG }, USER, db);
    expect(r).toEqual({ status: 403, json: { error: 'suspended', message: 'Contul tău este suspendat.' } });
    expect(from).toHaveBeenCalledWith('profiles');
    expect(rpc).not.toHaveBeenCalled();
  });
});
