import type { SupabaseClient } from '@supabase/supabase-js';
import { applyOverrides, resetTexts, t } from '../texts/store';
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
  it('access bonus', () => expect(ledgerLabel(entry({ kind: 'access_bonus', delta: 100 }))).toBe('Credite incluse în acces'));
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
  it('check of a deleted exercise', () => expect(ledgerLabel(entry({ target: 'exercise' }))).toBe('Verificare cu profesorul digital'));
  it('BAC grading rows', () => {
    expect(ledgerLabel(entry({ kind: 'check', delta: -10, target: 'bac:s1' }))).toBe('Corectare subiect');
    expect(ledgerLabel(entry({ kind: 'check', delta: -10, target: 'bac:s1', bacTitle: 'Istorie 2026 · Varianta 3' }))).toBe('Corectare subiect · Istorie 2026 · Varianta 3');
    expect(ledgerLabel(entry({ kind: 'refund', delta: 10, target: 'bac:s1', bacTitle: 'Varianta 3' }))).toBe('Corectare nereușită · returnat · Varianta 3');
    expect(ledgerLabel(entry({ kind: 'refund', delta: 10, target: 'bac:s1' }))).toBe('Corectare nereușită · returnat');
  });
  it('refund', () => expect(ledgerLabel(entry({ kind: 'refund' }))).toBe('Verificare nereușită · returnat'));
  it('referral names the invitee, or falls back when they are gone', () => {
    expect(ledgerLabel(entry({ kind: 'referral', delta: 40, referralName: 'Ana' }))).toBe('Recomandare: Ana');
    expect(ledgerLabel(entry({ kind: 'referral', delta: 40, referralName: null }))).toBe('Recomandare');
    expect(ledgerLabel(entry({ kind: 'referral', delta: 40 }))).toBe('Recomandare');
  });
  it('access bonus: from a purchase, or included in the free access from referrals', () => {
    expect(ledgerLabel(entry({ kind: 'access_bonus', delta: 100 }))).toBe('Credite incluse în acces');
    expect(ledgerLabel(entry({ kind: 'access_bonus', delta: 100, fromReferral: true }))).toBe('Credite incluse în accesul gratuit din recomandări');
  });
  it('check and refund rows name the lesson of their exercise', () => {
    const viewpoint = { type: 'viewpoint' as const, prompt: 'p', lesson: 'Cuza' };
    expect(ledgerLabel(entry({ delta: -1, target: 'exercise', exercise: viewpoint }))).toBe('Punct de vedere · Cuza');
    const essay = { type: 'essay' as const, prompt: 'p', requirements: ['r1', 'r2'], lesson: 'Cuza' };
    expect(ledgerLabel(entry({ target: 'req:r2', exercise: essay }))).toBe('Eseu · cerința 2 · Cuza');
    expect(ledgerLabel(entry({ target: 'whole', exercise: essay }))).toBe('Eseu · eseul întreg · Cuza');
    expect(ledgerLabel(entry({ kind: 'refund', delta: 1, exercise: viewpoint }))).toBe('Verificare nereușită · returnat · Cuza');
    // Only check / refund rows carry the lesson.
    expect(ledgerLabel(entry({ kind: 'admin', reason: 'Bonus', exercise: viewpoint }))).toBe('Ajustare · Bonus');
  });
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

  it('maps 409 to package_unavailable with the catalog text', async () => {
    fetchMock.mockResolvedValue(json(409, { error: 'package_unavailable', message: 'Pachetul nu mai e disponibil.' }));
    const err = await purchaseCredits('p1').catch((e) => e);
    expect(err).toBeInstanceOf(CreditsApiError);
    expect(err.code).toBe('package_unavailable');
    expect(err.message).toBe(t('errors.api.credits.packageUnavailable'));
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
      message: 'Cumpărarea nu a reușit. Încearcă din nou.',
    });
  });

  it('on 403 suspended refreshes the profile and throws the server message', async () => {
    const refresh = jest.fn().mockResolvedValue(null);
    const unregister = registerProfileRefresh(refresh);
    try {
      fetchMock.mockResolvedValue(json(403, { error: 'suspended', message: 'Contul tău este suspendat.' }));
      const err = await purchaseCredits('p1').catch((e) => e);
      expect(err).toBeInstanceOf(CreditsApiError);
      expect(err.code).toBe('suspended');
      expect(err.message).toBe('Contul tău este suspendat.');
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(mockSignOut).not.toHaveBeenCalled();
    } finally {
      unregister();
    }
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
  const auth = { getSession: () => Promise.resolve({ data: { session: { user: { id: 'me' } } }, error: null }) };
  return { client: { from: jest.fn(() => builder), auth } as unknown as SupabaseClient, calls };
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
            lessons: { title: 'Cuza' },
          },
        },
        {
          id: 7,
          delta: -1,
          balance_after: 0,
          kind: 'check',
          target: 'exercise',
          reason: null,
          created_at: 't',
          // An unpublished lesson the student cannot read: no title.
          consolidation_exercises: { type: 'viewpoint', prompt: 'Q', content: {}, lessons: null },
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
    expect(rows[0].exercise).toEqual({ type: 'essay', prompt: 'P', requirements: ['a', 'b'], lesson: 'Cuza' });
    expect(rows[0].balanceAfter).toBe(4);
    expect(rows[1].exercise).toEqual({ type: 'viewpoint', prompt: 'Q' });
    expect(rows[2].exercise).toBeNull();
    expect(calls).toContainEqual([
      'select',
      ['id,delta,balance_after,kind,target,reason,created_at,referral_id,consolidation_exercises(type,prompt,content,lessons(title))'],
    ]);
    expect(calls).toContainEqual(['limit', [30]]);
    expect(calls).toContainEqual(['lt', ['id', 10]]);
    expect(calls).toContainEqual(['order', ['id', { ascending: false }]]);
    // An admin's RLS reads every student's ledger: the app must ask for its own rows only.
    expect(calls).toContainEqual(['eq', ['user_id', 'me']]);
  });

  it('fetchLedger names the invitee of a referral row from my_referrals, and skips that call without one', async () => {
    const row = (id: number, kind: string, referral_id: string | null) => ({
      id, delta: 40, balance_after: 40, kind, target: null, reason: null, created_at: 't', referral_id, consolidation_exercises: null,
    });
    const { client } = fakeClient({ data: [row(2, 'referral', 'r1'), row(1, 'referral', 'gone')], error: null });
    const rpc = jest.fn().mockResolvedValue({
      data: [{ id: 'r1', first_name: 'Ana', email: null, state: 'converted_credits', created_at: 't', first_paid_at: null, reward_credits: 40, account_deleted: false }],
      error: null,
    });
    (client as unknown as { rpc: unknown }).rpc = rpc;
    const rows = await fetchLedger({}, client);
    expect(rpc).toHaveBeenCalledWith('my_referrals');
    expect(rows.map((r) => r.referralName)).toEqual(['Ana', null]);
    expect(ledgerLabel(rows[0])).toBe('Recomandare: Ana');

    const deleted = fakeClient({ data: [row(4, 'referral', 'r2')], error: null });
    (deleted.client as unknown as { rpc: unknown }).rpc = jest.fn().mockResolvedValue({
      data: [{ id: 'r2', first_name: 'Dan', email: null, state: 'converted_credits', created_at: 't', first_paid_at: null, reward_credits: 40, account_deleted: true }],
      error: null,
    });
    const deletedRows = await fetchLedger({}, deleted.client);
    expect(ledgerLabel(deletedRows[0])).toBe('Recomandare: Dan');

    // A bonus row of the free access carries the referral link but needs no name lookup.
    const bonus = fakeClient({ data: [row(5, 'access_bonus', 'r1'), row(6, 'access_bonus', null)], error: null });
    const rpc3 = jest.fn();
    (bonus.client as unknown as { rpc: unknown }).rpc = rpc3;
    const bonusRows = await fetchLedger({}, bonus.client);
    expect(rpc3).not.toHaveBeenCalled();
    expect(bonusRows.map((r) => ledgerLabel(r))).toEqual(['Credite incluse în accesul gratuit din recomandări', 'Credite incluse în acces']);

    const plain = fakeClient({ data: [row(3, 'welcome', null)], error: null });
    const rpc2 = jest.fn();
    (plain.client as unknown as { rpc: unknown }).rpc = rpc2;
    await fetchLedger({}, plain.client);
    expect(rpc2).not.toHaveBeenCalled();
  });

  it('fetchLedger still lists a referral row when my_referrals fails', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { client } = fakeClient({
      data: [{ id: 2, delta: 40, balance_after: 40, kind: 'referral', target: null, reason: null, created_at: 't', referral_id: 'r1', consolidation_exercises: null }],
      error: null,
    });
    (client as unknown as { rpc: unknown }).rpc = jest.fn().mockResolvedValue({ data: null, error: new Error('down') });
    const rows = await fetchLedger({}, client);
    expect(ledgerLabel(rows[0])).toBe('Recomandare');
  });

  it('fetchCreditBalance reads profiles.credit_balance', async () => {
    const { client } = fakeClient({ data: { credit_balance: 3 }, error: null });
    await expect(fetchCreditBalance('u1', client)).resolves.toBe(3);
  });
});

describe('fetchLedger names the BAC subject of a grading row', () => {
  it('reads the titles of the subjects in the rows', async () => {
    const ledger = [{ id: 3, delta: -10, balance_after: 2, kind: 'check', target: 'bac:s1', reason: null, created_at: 't', consolidation_exercises: null }];
    const chain = (data: unknown) => {
      const b: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'order', 'limit', 'lt', 'in']) b[m] = () => b;
      b.then = (res: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(res);
      return b;
    };
    const from = jest.fn((t: string) => chain(t === 'bac_subjects' ? [{ id: 's1', title: 'Istorie 2026 · Varianta 3' }] : ledger));
    const auth = { getSession: () => Promise.resolve({ data: { session: { user: { id: 'me' } } }, error: null }) };
    const [row] = await fetchLedger({}, { from, auth } as unknown as SupabaseClient);
    expect(from).toHaveBeenCalledWith('bac_subjects');
    expect(row).toMatchObject({ bacTitle: 'Istorie 2026 · Varianta 3' });
  });
});

describe('purchaseCredits: server error codes become catalog texts', () => {
  const SERVER = 'server text';
  const json = (status: number, body: unknown) => ({ ok: status < 300, status, json: async () => body });
  afterEach(() => resetTexts());

  it.each([
    ['bad_request', 'errors.api.badRequest'],
    ['unauthorized', 'errors.api.unauthorized'],
    ['package_unavailable', 'errors.api.credits.packageUnavailable'],
    ['suspended', 'errors.api.suspended'],
    ['server_error', 'errors.api.credits.serverError'],
    ['some_new_code', 'errors.api.generic'],
  ] as const)('%s → %s', async (code, key) => {
    fetchMock.mockResolvedValue(json(code === 'suspended' ? 403 : 400, { error: code, message: SERVER }));
    const err = await purchaseCredits('p1').catch((e) => e);
    expect(err).toBeInstanceOf(CreditsApiError);
    expect(err.code).toBe(code);
    expect(err.message).toBe(t(key));
  });

  it('an admin override replaces the text', async () => {
    applyOverrides({ 'errors.api.credits.packageUnavailable': '[override]', 'errors.purchase.failed': '[failed]' });
    fetchMock.mockResolvedValue(json(409, { error: 'package_unavailable', message: SERVER }));
    await expect(purchaseCredits('p1')).rejects.toMatchObject({ message: '[override]' });
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: async () => Promise.reject(new Error('html')) });
    await expect(purchaseCredits('p1')).rejects.toMatchObject({ message: '[failed]' });
  });
});

describe('ledgerLabel texts', () => {
  afterEach(() => resetTexts());

  it('reads the row names and the exercise type names from the texts (overrides apply)', () => {
    applyOverrides({ 'credits.ledger.purchase': '[{credite}]', 'consolidation.type.causeEffect': '[ce]' });
    expect(ledgerLabel(entry({ kind: 'purchase', delta: 20 }))).toBe('[20 de credite]');
    expect(ledgerLabel(entry({ delta: -1, target: 'exercise', exercise: { type: 'cause_effect', prompt: 'p' } }))).toBe('[ce]');
  });
});
