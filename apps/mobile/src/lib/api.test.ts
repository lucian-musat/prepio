import { deleteAccount, evaluateEssay, AccountDeleteApiError, EvaluateApiError, EVALUATE_TIMEOUT_MS } from './api';
import { getAccessToken, signOut } from './supabase';

jest.mock('./supabase', () => {
  class AuthOutageError extends Error {
    name = 'AuthOutageError';
  }
  return {
    apiUrl: () => process.env.EXPO_PUBLIC_API_URL || undefined,
    getAccessToken: jest.fn(),
    signOut: jest.fn(),
    AuthOutageError,
  };
});
const { AuthOutageError: MockOutage } = jest.requireMock('./supabase') as { AuthOutageError: new () => Error };

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
  jest.restoreAllMocks();
  if (ORIGINAL_API_URL === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = ORIGINAL_API_URL;
});

const req = { exerciseId: 'e1', text: 'Eseu' };
const json = (status: number, body: unknown) => ({ ok: status < 300, status, json: async () => body });

it('posts JSON to EXPO_PUBLIC_API_URL and returns the parsed response', async () => {
  const ok = { grade: 8, gradeMin: 1, gradeMax: 10, summary: 'Bine', suggestions: ['a'] };
  fetchMock.mockResolvedValue(json(200, ok));
  await expect(evaluateEssay(req)).resolves.toEqual(ok);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('https://api.prepio.test/api/evaluate');
  expect(init.method).toBe('POST');
  expect(init.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer token-1' });
  expect(JSON.parse(init.body)).toEqual(req);
});

it('reads the access token at call time (a refreshed token is used by the next call)', async () => {
  const ok = { grade: 8, gradeMin: 1, gradeMax: 10, summary: 'Bine', suggestions: [] };
  fetchMock.mockResolvedValue(json(200, ok));
  mockToken.mockResolvedValueOnce('token-1').mockResolvedValueOnce('token-2');
  await evaluateEssay(req);
  await evaluateEssay(req);
  expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer token-1');
  expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer token-2');
  expect(mockToken).toHaveBeenCalledTimes(2);
});

it('maps 401 to unauthorized with the session-expired message and signs out', async () => {
  fetchMock.mockResolvedValue(json(401, { error: 'unauthorized', message: 'Trebuie să fii autentificat.' }));
  const err = await evaluateEssay(req).catch((e) => e);
  expect(err).toBeInstanceOf(EvaluateApiError);
  expect(err.code).toBe('unauthorized');
  expect(err.message).toBe('Sesiunea a expirat. Intră din nou în cont.');
  expect(mockSignOut).toHaveBeenCalledTimes(1);
});

it('without a session, fails as unauthorized and signs out without calling the API', async () => {
  mockToken.mockResolvedValue(null);
  const err = await evaluateEssay(req).catch((e) => e);
  expect(err).toBeInstanceOf(EvaluateApiError);
  expect(err.code).toBe('unauthorized');
  expect(err.message).toBe('Sesiunea a expirat. Intră din nou în cont.');
  expect(fetchMock).not.toHaveBeenCalled();
  expect(mockSignOut).toHaveBeenCalledTimes(1);
});

it('an auth outage (expired token, offline refresh) is a connection error and keeps the session', async () => {
  mockToken.mockRejectedValue(new MockOutage());
  const err = await evaluateEssay(req).catch((e) => e);
  expect(err).toBeInstanceOf(EvaluateApiError);
  expect(err.code).toBe('ai_failed');
  expect(err.message).toBe('Nu ne-am putut conecta. Verifică internetul și încearcă din nou.');
  expect(fetchMock).not.toHaveBeenCalled();
  expect(mockSignOut).not.toHaveBeenCalled();
});

it('keeps the session on a server error (5xx is not a logout)', async () => {
  fetchMock.mockResolvedValue(json(502, { error: 'ai_failed', message: 'Evaluarea nu a reușit. Încearcă din nou.' }));
  const err = await evaluateEssay(req).catch((e) => e);
  expect(err.code).toBe('ai_failed');
  expect(mockSignOut).not.toHaveBeenCalled();
});

describe('deleteAccount', () => {
  const noContent = { ok: true, status: 204, json: async () => { throw new Error('no body'); } };

  it('posts to /api/account/delete with the bearer and no body; resolves on 204 without signing out', async () => {
    fetchMock.mockResolvedValue(noContent);
    await expect(deleteAccount()).resolves.toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.prepio.test/api/account/delete');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ Authorization: 'Bearer token-1' });
    expect(init.body).toBeUndefined();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('throws the server message on 403 forbidden and 500 server_error, keeping the session', async () => {
    for (const [status, body] of [
      [403, { error: 'forbidden', message: 'Contul de administrator nu poate fi șters de aici.' }],
      [500, { error: 'server_error', message: 'Contul nu a putut fi șters. Încearcă din nou.' }],
    ] as const) {
      fetchMock.mockResolvedValue(json(status, body));
      const err = await deleteAccount().catch((e) => e);
      expect(err).toBeInstanceOf(AccountDeleteApiError);
      expect(err).toBeInstanceOf(Error);
      expect(err.code).toBe(body.error);
      expect(err.message).toBe(body.message);
    }
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('maps 401 to the session-expired message and signs out', async () => {
    fetchMock.mockResolvedValue(json(401, { error: 'unauthorized', message: 'Trebuie să fii autentificat.' }));
    const err = await deleteAccount().catch((e) => e);
    expect(err.code).toBe('unauthorized');
    expect(err.message).toBe('Sesiunea a expirat. Intră din nou în cont.');
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('without a session, fails as unauthorized without calling the API', async () => {
    mockToken.mockResolvedValue(null);
    const err = await deleteAccount().catch((e) => e);
    expect(err.code).toBe('unauthorized');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('an auth outage is a connection error, keeps the session and calls nothing', async () => {
    mockToken.mockRejectedValue(new MockOutage());
    const err = await deleteAccount().catch((e) => e);
    expect(err).toBeInstanceOf(AccountDeleteApiError);
    expect(err.code).toBe('server_error');
    expect(err.message).toBe('Nu ne-am putut conecta. Verifică internetul și încearcă din nou.');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('maps a network failure and an unparseable error body to Romanian messages', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    let err = await deleteAccount().catch((e) => e);
    expect(err.code).toBe('server_error');
    expect(err.message).toBe('Nu ne-am putut conecta. Verifică internetul și încearcă din nou.');

    fetchMock.mockResolvedValue({ ok: false, status: 502, json: async () => { throw new Error('html'); } });
    err = await deleteAccount().catch((e) => e);
    expect(err.code).toBe('server_error');
    expect(err.message).toBe('Contul nu a putut fi șters. Încearcă din nou.');
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('fails clearly when EXPO_PUBLIC_API_URL is unset', async () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const err = await deleteAccount().catch((e) => e);
    expect(err.code).toBe('server_error');
    expect(err.message).toBe('Ștergerea contului nu este disponibilă momentan. Încearcă din nou mai târziu.');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

it('fails with a clear ai_failed error and never calls localhost when EXPO_PUBLIC_API_URL is unset', async () => {
  delete process.env.EXPO_PUBLIC_API_URL;
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  const err = await evaluateEssay(req).catch((e) => e);
  expect(err).toBeInstanceOf(EvaluateApiError);
  expect(err.code).toBe('ai_failed');
  expect(err.message).toBe('Evaluarea nu este disponibilă momentan. Încearcă din nou mai târziu.');
  expect(fetchMock).not.toHaveBeenCalled();
  expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('EXPO_PUBLIC_API_URL'));
});

it('throws EvaluateApiError with the server code and message on 429', async () => {
  fetchMock.mockResolvedValue(json(429, { error: 'rate_limited', message: 'Prea multe cereri.' }));
  const err = await evaluateEssay(req).catch((e) => e);
  expect(err).toBeInstanceOf(EvaluateApiError);
  expect(err.code).toBe('rate_limited');
  expect(err.message).toBe('Prea multe cereri.');
});

it('maps a network failure to ai_failed with the connection message', async () => {
  fetchMock.mockRejectedValue(new TypeError('Network request failed'));
  const err = await evaluateEssay(req).catch((e) => e);
  expect(err).toBeInstanceOf(EvaluateApiError);
  expect(err.code).toBe('ai_failed');
  expect(err.message).toBe('Nu ne-am putut conecta. Verifică internetul și încearcă din nou.');
});

it('maps an unparseable error body to ai_failed', async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => { throw new Error('x'); } });
  const err = await evaluateEssay(req).catch((e) => e);
  expect(err.code).toBe('ai_failed');
  expect(err.message).toBe('Evaluarea nu a reușit. Încearcă din nou.');
});

it('aborts after 65 s and reports that the evaluation took too long', async () => {
  jest.useFakeTimers();
  expect(EVALUATE_TIMEOUT_MS).toBe(65_000);
  let signal: AbortSignal | undefined;
  fetchMock.mockImplementation(
    (_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        signal = init.signal ?? undefined;
        init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      }),
  );
  const pending = evaluateEssay(req).catch((e) => e);
  await jest.advanceTimersByTimeAsync(64_999);
  expect(signal?.aborted).toBe(false);
  await jest.advanceTimersByTimeAsync(1);
  const err = await pending;
  expect(signal?.aborted).toBe(true);
  expect(err).toBeInstanceOf(EvaluateApiError);
  expect(err.code).toBe('ai_failed');
  expect(err.message).toBe('Evaluarea durează prea mult. Încearcă din nou.');
});

it('clears the timeout once the response arrives', async () => {
  jest.useFakeTimers();
  fetchMock.mockResolvedValue(json(200, { grade: 8, gradeMin: 1, gradeMax: 10, summary: 'Bine', suggestions: [] }));
  await evaluateEssay(req);
  expect(jest.getTimerCount()).toBe(0);
});
