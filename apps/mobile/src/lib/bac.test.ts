import type { SupabaseClient } from '@supabase/supabase-js';
import type { BacItem } from '@prepio/shared';
import { answeredCount, BacApiError, BacDraftLocked, fetchBacList, fetchLatestGraded, fetchOpenAttempt, saveBacDraft, submitBac } from './bac';
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
  registerProfileRefresh(async () => {});
});
afterEach(() => {
  if (ORIGINAL_API_URL === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = ORIGINAL_API_URL;
});

type Result = { data: unknown; error: unknown };
function mockClient(results: Record<string, Result>, rpcResult: Result = { data: null, error: null }, userId: string | null = 'me') {
  const rpcCalls: Array<{ fn: string; args: unknown }> = [];
  /** Every `.eq(column, value)` per table, to prove the queries are scoped to the signed-in user. */
  const eqCalls: Array<{ table: string; column: string; value: unknown }> = [];
  const from = (table: string) => {
    const result = results[table] ?? { data: null, error: null };
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'in', 'order', 'limit', 'maybeSingle']) chain[m] = () => (m === 'maybeSingle' ? Promise.resolve(result) : chain);
    chain.eq = (column: string, value: unknown) => {
      eqCalls.push({ table, column, value });
      return chain;
    };
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(result).then(res, rej);
    return chain;
  };
  const rpc = (fn: string, args: unknown) => {
    rpcCalls.push({ fn, args });
    return Promise.resolve(rpcResult);
  };
  const auth = {
    getSession: () => Promise.resolve({ data: { session: userId ? { user: { id: userId } } : null }, error: null }),
  };
  return { client: { from, rpc, auth } as unknown as SupabaseClient, rpcCalls, eqCalls };
}

// An admin's RLS lets them read every student's attempts (the admin student page needs that), so the app must ask
// only for the signed-in user's own rows: otherwise an admin sees another student's grade as their own.
describe('attempt queries are scoped to the signed-in user', () => {
  const ownOnly = (eqCalls: Array<{ table: string; column: string; value: unknown }>) =>
    eqCalls.some((c) => c.table === 'bac_attempts' && c.column === 'user_id' && c.value === 'me');

  it('fetchBacList', async () => {
    const { client, eqCalls } = mockClient({ bac_subjects: { data: [], error: null }, bac_attempts: { data: [], error: null } });
    await fetchBacList(client);
    expect(ownOnly(eqCalls)).toBe(true);
  });

  it('fetchOpenAttempt', async () => {
    const { client, eqCalls } = mockClient({ bac_attempts: { data: null, error: null } });
    await fetchOpenAttempt('s1', client);
    expect(ownOnly(eqCalls)).toBe(true);
  });

  it('fetchLatestGraded', async () => {
    const { client, eqCalls } = mockClient({ bac_attempts: { data: null, error: null } });
    await fetchLatestGraded('s1', client);
    expect(ownOnly(eqCalls)).toBe(true);
  });

  it('without a session nothing is read as „mine”', async () => {
    const { client } = mockClient({ bac_attempts: { data: null, error: null } }, undefined, null);
    await expect(fetchOpenAttempt('s1', client)).rejects.toThrow();
  });
});

const subject = (id: string, year: number, position = 0) => ({ id, title: `T-${id}`, year, variant: '1', credit_cost: 10, position });

describe('fetchBacList', () => {
  const subjects = [subject('a', 2024), subject('b', 2025, 1), subject('c', 2025, 0), subject('d', 2023)];

  it('orders by year desc then position and derives new / draft / completed with the last grade', async () => {
    const { client } = mockClient({
      bac_subjects: { data: subjects, error: null },
      bac_attempts: {
        data: [
          { subject_id: 'a', status: 'graded', grade: '7.50', position: null, graded_at: '2026-01-01T00:00:00Z' },
          { subject_id: 'a', status: 'graded', grade: '8.40', position: null, graded_at: '2026-02-01T00:00:00Z' },
          { subject_id: 'b', status: 'graded', grade: '9.00', position: null, graded_at: '2026-01-01T00:00:00Z' },
          { subject_id: 'b', status: 'draft', grade: null, position: { section: 2, index: 1 }, graded_at: null },
        ],
        error: null,
      },
    });
    const rows = await fetchBacList(client);
    expect(rows.map((r) => r.id)).toEqual(['c', 'b', 'a', 'd']);
    const by = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(by.a).toMatchObject({ state: 'completed', lastGrade: 8.4, position: null });
    expect(by.b).toMatchObject({ state: 'draft', lastGrade: 9, position: { section: 2, index: 1 } });
    expect(by.c).toMatchObject({ state: 'new', lastGrade: null, creditCost: 10 });
  });

  it('trial students (no readable attempts) get every subject as new', async () => {
    const { client } = mockClient({ bac_subjects: { data: subjects, error: null }, bac_attempts: { data: [], error: null } });
    expect((await fetchBacList(client)).every((r) => r.state === 'new')).toBe(true);
  });

  it('reports grading and failed attempts', async () => {
    const { client } = mockClient({
      bac_subjects: { data: [subject('a', 2024), subject('b', 2024, 1)], error: null },
      bac_attempts: {
        data: [
          { subject_id: 'a', status: 'grading', grade: null, position: null, graded_at: null },
          { subject_id: 'b', status: 'failed', grade: null, position: null, graded_at: null },
        ],
        error: null,
      },
    });
    expect((await fetchBacList(client)).map((r) => r.state)).toEqual(['grading', 'failed']);
  });

  it('throws a query error', async () => {
    const { client } = mockClient({ bac_subjects: { data: null, error: new Error('boom') } });
    await expect(fetchBacList(client)).rejects.toThrow('boom');
  });
});

describe('saveBacDraft', () => {
  it('calls the RPC with the arguments', async () => {
    const { client, rpcCalls } = mockClient({});
    const answers = { i1: { type: 'short_answer' as const, text: 'x' } };
    await saveBacDraft('s1', answers, { section: 1, index: 2 }, client);
    expect(rpcCalls).toEqual([
      { fn: 'save_bac_draft', args: { p_subject: 's1', p_answers: answers, p_position: { section: 1, index: 2 } } },
    ]);
  });

  it('maps the grading error to BacDraftLocked and rethrows others', async () => {
    const locked = mockClient({}, { data: null, error: { code: 'P0001', message: 'grading' } });
    await expect(saveBacDraft('s1', {}, { section: 1, index: 0 }, locked.client)).rejects.toBeInstanceOf(BacDraftLocked);
    const denied = mockClient({}, { data: null, error: { code: '42501', message: 'no' } });
    await expect(saveBacDraft('s1', {}, { section: 1, index: 0 }, denied.client)).rejects.toEqual({ code: '42501', message: 'no' });
  });
});

const respond = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

describe('submitBac', () => {
  const req = { subjectId: 's1', answers: {} };

  it('posts with the bearer token and returns the response', async () => {
    const ok = { attemptId: 'a1', points: 80, grade: 9, results: [], credits: { spent: 10, balance: 5 } };
    fetchMock.mockResolvedValue(respond(200, ok));
    await expect(submitBac(req)).resolves.toEqual(ok);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.prepio.test/api/bac/submit');
    expect(init.headers.Authorization).toBe('Bearer token-1');
  });

  it('maps 402 to BacApiError with required and balance', async () => {
    fetchMock.mockResolvedValue(respond(402, { error: 'insufficient_credits', message: 'm', required: 10, balance: 3 }));
    await expect(submitBac(req)).rejects.toMatchObject({ code: 'insufficient_credits', required: 10, balance: 3 });
  });

  it('maps 502 to BacApiError carrying the refunded credits', async () => {
    const credits = { spent: 0, balance: 12 };
    fetchMock.mockResolvedValue(respond(502, { error: 'grading_failed', message: 'm', credits }));
    const err = await submitBac(req).catch((e) => e);
    expect(err).toBeInstanceOf(BacApiError);
    expect(err).toMatchObject({ code: 'grading_failed', credits, balance: 12 });
  });

  it('signs out on 401', async () => {
    fetchMock.mockResolvedValue(respond(401, { error: 'unauthorized', message: 'm' }));
    await expect(submitBac(req)).rejects.toMatchObject({ code: 'unauthorized' });
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('a network error is the offline message', async () => {
    fetchMock.mockRejectedValue(new Error('net'));
    await expect(submitBac(req)).rejects.toMatchObject({ code: 'grading_failed', message: expect.stringContaining('conecta') });
  });
});

const base = { section: 1 as const, number: 1, points: 10, prompt: 'p', sources: [], modelAnswer: null, explanation: null, templateId: null, position: 0 };
const item = (id: string, rest: Record<string, unknown>) => ({ ...base, id, ...rest }) as unknown as BacItem;

describe('answeredCount', () => {
  const essay = item('e', { type: 'essay', requirements: [{ id: 'r1', text: 'a' }, { id: 'r2', text: 'b' }] });
  const short = item('s', { type: 'short_answer' });
  const letter = item('l', { type: 'source_letter' });
  const info = item('i', { type: 'source_info' });

  it('an essay with one empty requirement is not answered', () => {
    const partial = { e: { type: 'essay' as const, parts: { r1: 'text', r2: '  ' } } };
    expect(answeredCount([essay], partial)).toMatchObject({ answered: 0, total: 1, empty: [essay] });
    const full = { e: { type: 'essay' as const, parts: { r1: 'text', r2: 'more' } } };
    expect(answeredCount([essay], full).answered).toBe(1);
  });

  it('counts text, letter and marks, ignoring blanks', () => {
    const answers = {
      s: { type: 'short_answer' as const, text: ' ' },
      l: { type: 'source_letter' as const, letter: 'A' as const },
      i: { type: 'source_info' as const, marks: [{ sourceId: 'x', from: 0, to: 3 }] },
    } as any;
    const r = answeredCount([short, letter, info], answers);
    expect(r.answered).toBe(2);
    expect(r.empty).toEqual([short]);
  });
});
