import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CreditsApiError,
  fetchCreditBalance,
  fetchCreditPackages,
  fetchLedger,
  ledgerLabel,
  purchaseCredits,
  type StudentLedgerEntry,
} from './credits';
import { getAccessToken, signOut } from './supabase';

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
  jest.useRealTimers();
  if (ORIGINAL_API_URL === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = ORIGINAL_API_URL;
});

const entry = (over: Partial<StudentLedgerEntry>): StudentLedgerEntry => ({
  id: 1,
  delta: 0,
  balanceAfter: 0,
  kind: 'check',
  target: null,
  reason: null,
  createdAt: '2026-11-06T10:00:00Z',
  exercise: null,
  ...over,
});

describe('ledgerLabel', () => {
  it('welcome', () => expect(ledgerLabel(entry({ kind: 'welcome', delta: 5 }))).toBe('Credite de bun venit'));
  it('purchase', () => {
    expect(ledgerLabel(entry({ kind: 'purchase', delta: 20 }))).toBe('Pachet 20 de credite');
    expect(ledgerLabel(entry({ kind: 'purchase', delta: 1 }))).toBe('Pachet 1 credit');
  });
  it('check of a non-essay exercise', () => {
    const exercise = { type: 'cause_effect' as const, prompt: 'p' };
    expect(ledgerLabel(entry({ delta: -1, target: 'exercise', exercise }))).toBe('Cauză-efect');
  });
  it('essay requirement N and whole essay', () => {
    const exercise = { type: 'essay' as const, prompt: 'p', requirements: ['r1', 'r2', 'r3'] };
    expect(ledgerLabel(entry({ target: 'req:r2', exercise }))).toBe('Eseu · cerința 2');
    expect(ledgerLabel(entry({ target: 'whole', exercise }))).toBe('Eseu · eseul întreg');
  });
  it('check of a deleted exercise', () => expect(ledgerLabel(entry({ target: 'exercise' }))).toBe('Verificare'));
  it('refund', () => expect(ledgerLabel(entry({ kind: 'refund' }))).toBe('Verificare nereușită · returnat'));
  it('admin without a reason', () => {
    expect(ledgerLabel(entry({ kind: 'admin', reason: null }))).toBe('Ajustare');
    expect(ledgerLabel(entry({ kind: 'admin', reason: '  ' }))).toBe('Ajustare');
  });
  it('admin', () => expect(ledgerLabel(entry({ kind: 'admin', reason: 'Bonus' }))).toBe('Ajustare · Bonus'));
});

describe('purchaseCredits', () => {
  const json = (status: number, body: unknown) => ({ ok: status < 300, status, json: async () => body });

  it('posts the package id and returns the response', async () => {
    const ok = { orderId: 'o1', credits: 20, balance: 25 };
    fetchMock.mockResolvedValue(json(200, ok));
    await expect(purchaseCredits('p1')).resolves.toEqual(ok);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.prepio.test/api/credits/purchase');
    expect(JSON.parse(init.body)).toEqual({ packageId: 'p1' });
    expect(init.headers.Authorization).toBe('Bearer token-1');
  });

  it('maps 409 to package_unavailable with the server message', async () => {
    fetchMock.mockResolvedValue(json(409, { error: 'package_unavailable', message: 'Pachetul nu mai e disponibil.' }));
    const err = await purchaseCredits('p1').catch((e) => e);
    expect(err).toBeInstanceOf(CreditsApiError);
    expect(err.code).toBe('package_unavailable');
    expect(err.message).toBe('Pachetul nu mai e disponibil.');
  });

  it('signs out on 401', async () => {
    fetchMock.mockResolvedValue(json(401, { error: 'unauthorized', message: 'x' }));
    await expect(purchaseCredits('p1')).rejects.toMatchObject({ code: 'unauthorized' });
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('signs out when there is no token', async () => {
    mockToken.mockResolvedValue(null);
    await expect(purchaseCredits('p1')).rejects.toMatchObject({ code: 'unauthorized' });
    expect(mockSignOut).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports offline as server_error without signing out', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    await expect(purchaseCredits('p1')).rejects.toMatchObject({
      code: 'server_error',
      message: 'Nu ne-am putut conecta. Verifică internetul și încearcă din nou.',
    });
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('aborts after 15 s with a timeout error', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation(
      (_u: string, init: { signal: AbortSignal }) =>
        new Promise((_res, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted')))),
    );
    const p = purchaseCredits('p1').catch((e) => e);
    await jest.advanceTimersByTimeAsync(15_000);
    const err = await p;
    expect(err).toBeInstanceOf(CreditsApiError);
    expect(err.code).toBe('server_error');
    expect(err.message).toContain('prea mult');
  });

  it('rejects a 200 with a non-JSON body instead of returning null', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => Promise.reject(new Error('html')) });
    await expect(purchaseCredits('p1')).rejects.toMatchObject({
      code: 'server_error',
      message: 'Achiziția nu a reușit. Încearcă din nou.',
    });
  });

  it('uses a generic message for a non-JSON error', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: async () => Promise.reject(new Error('html')) });
    await expect(purchaseCredits('p1')).rejects.toMatchObject({ code: 'server_error' });
  });
});

function fakeClient(result: { data: unknown; error: unknown }) {
  const calls: Array<[string, unknown[]]> = [];
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order', 'limit', 'lt', 'maybeSingle']) {
    builder[m] = (...args: unknown[]) => {
      calls.push([m, args]);
      return builder;
    };
  }
  builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return { client: { from: jest.fn(() => builder) } as unknown as SupabaseClient, calls };
}

describe('queries', () => {
  it('fetchCreditPackages maps active packages ordered by sort_order', async () => {
    const { client, calls } = fakeClient({
      data: [{ id: 'p1', credits: 20, price_bani: 999, featured: true }],
      error: null,
    });
    await expect(fetchCreditPackages(client)).resolves.toEqual([{ id: 'p1', credits: 20, priceBani: 999, featured: true }]);
    expect(calls).toContainEqual(['eq', ['active', true]]);
    expect(calls).toContainEqual(['order', ['sort_order', { ascending: true }]]);
  });

  it('fetchLedger joins the exercise, maps requirements, and paginates', async () => {
    const { client, calls } = fakeClient({
      data: [
        {
          id: 9,
          delta: -1,
          balance_after: 4,
          kind: 'check',
          target: 'req:b',
          reason: null,
          created_at: 't',
          consolidation_exercises: {
            type: 'essay',
            prompt: 'P',
            content: { requirements: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] },
          },
        },
        {
          id: 8,
          delta: 5,
          balance_after: 5,
          kind: 'welcome',
          target: null,
          reason: null,
          created_at: 't',
          consolidation_exercises: null,
        },
      ],
      error: null,
    });
    const rows = await fetchLedger({ before: 10 }, client);
    expect(rows[0].exercise).toEqual({ type: 'essay', prompt: 'P', requirements: ['a', 'b'] });
    expect(rows[0].balanceAfter).toBe(4);
    expect(rows[1].exercise).toBeNull();
    expect(calls).toContainEqual(['limit', [30]]);
    expect(calls).toContainEqual(['lt', ['id', 10]]);
    expect(calls).toContainEqual(['order', ['id', { ascending: false }]]);
  });

  it('fetchCreditBalance reads profiles.credit_balance', async () => {
    const { client } = fakeClient({ data: { credit_balance: 3 }, error: null });
    await expect(fetchCreditBalance('u1', client)).resolves.toBe(3);
  });
});
