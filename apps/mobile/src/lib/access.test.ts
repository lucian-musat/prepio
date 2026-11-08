import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccessOffer } from '@prepio/shared';
import { AccessApiError, fetchAccessHistory, fetchAccessOffer, fetchAccessUntil, fetchFreeLessonId, fetchIsAdmin, purchaseAccess } from './access';
import { getAccessToken, signOut } from './supabase';
import { registerProfileRefresh } from './profileRefresh';

jest.mock('./supabase', () => {
  class AuthOutageError extends Error {
    name = 'AuthOutageError';
  }
  return {
    apiUrl: () => process.env.EXPO_PUBLIC_API_URL || undefined,
    getAccessToken: jest.fn(),
    signOut: jest.fn(),
    getSupabase: jest.fn(),
    AuthOutageError,
  };
});

const mockToken = getAccessToken as jest.Mock;
const mockSignOut = signOut as jest.Mock;
const fetchMock = jest.fn();
const ORIGINAL_API_URL = process.env.EXPO_PUBLIC_API_URL;

beforeEach(() => {
  fetchMock.mockReset();
  mockToken.mockReset().mockResolvedValue('token-1');
  mockSignOut.mockReset().mockResolvedValue(undefined);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  process.env.EXPO_PUBLIC_API_URL = 'https://api.prepio.test';
});
afterEach(() => {
  if (ORIGINAL_API_URL === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = ORIGINAL_API_URL;
});

/** Chainable PostgREST stub; each `from(table)` resolves with `results[table]`. */
function fakeClient(results: Record<string, { data: unknown; error: unknown }>) {
  const calls: Array<[string, string, unknown[]]> = [];
  const from = jest.fn((table: string) => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'order', 'limit', 'maybeSingle', 'single']) {
      b[m] = (...args: unknown[]) => {
        calls.push([table, m, args]);
        return b;
      };
    }
    b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(results[table]).then(res, rej);
    return b;
  });
  const rpc = jest.fn(async (fn: string) => results[`rpc:${fn}`]);
  return { client: { from, rpc } as unknown as SupabaseClient, from, rpc, calls };
}

describe('fetchAccessOffer', () => {
  it('maps access_settings', async () => {
    const { client, from } = fakeClient({ access_settings: { data: { price_bani: 15000, bonus_credits: 100, duration_months: 3 }, error: null } });
    await expect(fetchAccessOffer(client)).resolves.toEqual({ priceBani: 15000, bonusCredits: 100, durationMonths: 3 });
    expect(from).toHaveBeenCalledWith('access_settings');
  });
  it('throws on a database error', async () => {
    const { client } = fakeClient({ access_settings: { data: null, error: new Error('boom') } });
    await expect(fetchAccessOffer(client)).rejects.toThrow('boom');
  });
});

describe('fetchAccessUntil', () => {
  it('reads access_until of the own profile', async () => {
    const { client } = fakeClient({ profiles: { data: { access_until: '2027-02-08T10:00:00Z' }, error: null } });
    await expect(fetchAccessUntil('u1', client)).resolves.toBe('2027-02-08T10:00:00Z');
  });
  it('is null without a row or a date', async () => {
    const { client } = fakeClient({ profiles: { data: null, error: null } });
    await expect(fetchAccessUntil('u1', client)).resolves.toBeNull();
  });
});

describe('fetchAccessHistory', () => {
  it('joins purchases with their order price, selecting no admin columns', async () => {
    const { client, calls } = fakeClient({
      access_ledger: {
        data: [
          { kind: 'purchase', months: 3, until_after: '2027-02-08T10:00:00Z', created_at: '2026-11-08T10:00:00Z', order_id: 'o1' },
          { kind: 'admin_grant', months: 1, until_after: '2026-12-08T10:00:00Z', created_at: '2026-11-01T10:00:00Z', order_id: null },
          { kind: 'admin_revoke', months: null, until_after: '2026-11-02T10:00:00Z', created_at: '2026-11-02T10:00:00Z', order_id: null },
        ],
        error: null,
      },
      access_orders: { data: [{ id: 'o1', price_bani: 15000 }], error: null },
    });
    const rows = await fetchAccessHistory('u1', client);
    expect(rows).toEqual([
      { kind: 'purchase', months: 3, untilAfter: '2027-02-08T10:00:00Z', createdAt: '2026-11-08T10:00:00Z', priceBani: 15000 },
      { kind: 'admin_grant', months: 1, untilAfter: '2026-12-08T10:00:00Z', createdAt: '2026-11-01T10:00:00Z', priceBani: null },
      { kind: 'admin_revoke', months: null, untilAfter: '2026-11-02T10:00:00Z', createdAt: '2026-11-02T10:00:00Z', priceBani: null },
    ]);
    const select = calls.find(([t, m]) => t === 'access_ledger' && m === 'select')![2][0] as string;
    expect(select).not.toMatch(/admin_id|reason/);
    expect(calls).toContainEqual(['access_ledger', 'eq', ['user_id', 'u1']]);
  });
  it('skips the orders query when no row has an order', async () => {
    const { client, from } = fakeClient({ access_ledger: { data: [], error: null } });
    await expect(fetchAccessHistory('u1', client)).resolves.toEqual([]);
    expect(from).not.toHaveBeenCalledWith('access_orders');
  });
});

describe('fetchFreeLessonId', () => {
  it("is the server's free_lesson_id()", async () => {
    const { client, rpc } = fakeClient({ 'rpc:free_lesson_id': { data: 'x', error: null } });
    await expect(fetchFreeLessonId(client)).resolves.toBe('x');
    expect(rpc).toHaveBeenCalledWith('free_lesson_id');
  });
  it('is null with no published lessons', async () => {
    const { client } = fakeClient({ 'rpc:free_lesson_id': { data: null, error: null } });
    await expect(fetchFreeLessonId(client)).resolves.toBeNull();
  });
  it('throws on an rpc error', async () => {
    const { client } = fakeClient({ 'rpc:free_lesson_id': { data: null, error: new Error('boom') } });
    await expect(fetchFreeLessonId(client)).rejects.toThrow('boom');
  });
});

describe('fetchIsAdmin', () => {
  it('reads is_admin()', async () => {
    const yes = fakeClient({ 'rpc:is_admin': { data: true, error: null } });
    await expect(fetchIsAdmin(yes.client)).resolves.toBe(true);
    expect(yes.rpc).toHaveBeenCalledWith('is_admin');
    const no = fakeClient({ 'rpc:is_admin': { data: false, error: null } });
    await expect(fetchIsAdmin(no.client)).resolves.toBe(false);
  });
});

describe('purchaseAccess', () => {
  const offer: AccessOffer = { priceBani: 15000, bonusCredits: 100, durationMonths: 3 };
  const json = (status: number, body: unknown) => ({ ok: status < 300, status, json: async () => body });

  it('posts the expected offer and returns the response', async () => {
    const ok = { orderId: 'o1', accessUntil: '2027-02-08T10:00:00Z', bonus: 100, balance: 105 };
    fetchMock.mockResolvedValue(json(200, ok));
    await expect(purchaseAccess(offer)).resolves.toEqual(ok);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.prepio.test/api/access/purchase');
    expect(JSON.parse(init.body)).toEqual({ expectedPriceBani: 15000, expectedBonusCredits: 100, expectedDurationMonths: 3 });
    expect(init.headers.Authorization).toBe('Bearer token-1');
  });

  it('409 offer_changed carries the new offer', async () => {
    const fresh = { priceBani: 20000, bonusCredits: 50, durationMonths: 6 };
    fetchMock.mockResolvedValue(json(409, { error: 'offer_changed', message: 'Oferta s-a schimbat.', offer: fresh }));
    const err = await purchaseAccess(offer).catch((e) => e);
    expect(err).toBeInstanceOf(AccessApiError);
    expect(err.code).toBe('offer_changed');
    expect(err.offer).toEqual(fresh);
    expect(err.message).toBe('Oferta s-a schimbat.');
  });

  it('401 signs out', async () => {
    fetchMock.mockResolvedValue(json(401, { error: 'unauthorized', message: 'x' }));
    await expect(purchaseAccess(offer)).rejects.toMatchObject({ code: 'unauthorized' });
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('403 suspended refreshes the profile', async () => {
    const refresh = jest.fn().mockResolvedValue(null);
    const unregister = registerProfileRefresh(refresh);
    fetchMock.mockResolvedValue(json(403, { error: 'suspended', message: 'Suspendat.' }));
    await expect(purchaseAccess(offer)).rejects.toMatchObject({ code: 'suspended', message: 'Suspendat.' });
    expect(refresh).toHaveBeenCalledTimes(1);
    unregister();
  });

  it('a network failure is a server_error', async () => {
    fetchMock.mockRejectedValue(new Error('net'));
    await expect(purchaseAccess(offer)).rejects.toMatchObject({ code: 'server_error' });
  });

  it('a 200 without an accessUntil is a server_error', async () => {
    fetchMock.mockResolvedValue(json(200, {}));
    await expect(purchaseAccess(offer)).rejects.toMatchObject({ code: 'server_error' });
  });
});
