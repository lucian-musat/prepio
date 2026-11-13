import { deleteAccount, evaluateConsolidation, AccountDeleteApiError, EvaluateApiError, EVALUATE_TIMEOUT_MS } from './api';
import { MAX_ANSWER_CHARS } from '@prepio/shared';
import { applyOverrides, resetTexts, t } from '../texts/store';
import { registerAccessRefresh, registerProfileRefresh } from './profileRefresh';
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

const req = { exerciseId: 'e1', target: 'exercise' as const, answer: { type: 'comparison' as const, text: 'Eseu' } };
const json = (status: number, body: unknown) => ({ ok: status < 300, status, json: async () => body });

it('posts JSON to EXPO_PUBLIC_API_URL and returns the parsed response', async () => {
  const ok = { items: [{ key: 'whole', verdict: 'ok', title: 'T', good: ['a'], improve: [], ai: true }] };
  fetchMock.mockResolvedValue(json(200, ok));
  await expect(evaluateConsolidation(req)).resolves.toEqual(ok);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('https://api.prepio.test/api/consolidation/evaluate');
  expect(init.method).toBe('POST');
  expect(init.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer token-1' });
  expect(JSON.parse(init.body)).toEqual(req);
});

it('reads the access token at call time (a refreshed token is used by the next call)', async () => {
  const ok = { items: [] };
  fetchMock.mockResolvedValue(json(200, ok));
  mockToken.mockResolvedValueOnce('token-1').mockResolvedValueOnce('token-2');
  await evaluateConsolidation(req);
  await evaluateConsolidation(req);
  expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer token-1');
  expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer token-2');
  expect(mockToken).toHaveBeenCalledTimes(2);
});

it('maps 401 to unauthorized with the session-expired message and signs out', async () => {
  fetchMock.mockResolvedValue(json(401, { error: 'unauthorized', message: 'Trebuie să fii autentificat.' }));
  const err = await evaluateConsolidation(req).catch((e) => e);
  expect(err).toBeInstanceOf(EvaluateApiError);
  expect(err.code).toBe('unauthorized');
  expect(err.message).toBe('Sesiunea a expirat. Intră din nou în cont.');
  expect(mockSignOut).toHaveBeenCalledTimes(1);
});

it('without a session, fails as unauthorized and signs out without calling the API', async () => {
  mockToken.mockResolvedValue(null);
  const err = await evaluateConsolidation(req).catch((e) => e);
  expect(err).toBeInstanceOf(EvaluateApiError);
  expect(err.code).toBe('unauthorized');
  expect(err.message).toBe('Sesiunea a expirat. Intră din nou în cont.');
  expect(fetchMock).not.toHaveBeenCalled();
  expect(mockSignOut).toHaveBeenCalledTimes(1);
});

it('an auth outage (expired token, offline refresh) is a connection error and keeps the session', async () => {
  mockToken.mockRejectedValue(new MockOutage());
  const err = await evaluateConsolidation(req).catch((e) => e);
  expect(err).toBeInstanceOf(EvaluateApiError);
  expect(err.code).toBe('ai_failed');
  expect(err.message).toBe('Nu ne-am putut conecta. Verifică internetul și încearcă din nou.');
  expect(fetchMock).not.toHaveBeenCalled();
  expect(mockSignOut).not.toHaveBeenCalled();
});

it('keeps the session on a server error (5xx is not a logout)', async () => {
  fetchMock.mockResolvedValue(json(502, { error: 'ai_failed', message: 'Evaluarea nu a reușit. Încearcă din nou.' }));
  const err = await evaluateConsolidation(req).catch((e) => e);
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
    expect(err.message).toBe('Ștergerea contului nu e disponibilă acum. Încearcă mai târziu.');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

it('fails with a clear ai_failed error and never calls localhost when EXPO_PUBLIC_API_URL is unset', async () => {
  delete process.env.EXPO_PUBLIC_API_URL;
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  const err = await evaluateConsolidation(req).catch((e) => e);
  expect(err).toBeInstanceOf(EvaluateApiError);
  expect(err.code).toBe('ai_failed');
  expect(err.message).toBe('Evaluarea nu e disponibilă acum. Încearcă mai târziu.');
  expect(fetchMock).not.toHaveBeenCalled();
  expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('EXPO_PUBLIC_API_URL'));
});

it('throws EvaluateApiError with the server code and the catalog text on 429', async () => {
  fetchMock.mockResolvedValue(json(429, { error: 'rate_limited', message: 'Prea multe cereri.' }));
  const err = await evaluateConsolidation(req).catch((e) => e);
  expect(err).toBeInstanceOf(EvaluateApiError);
  expect(err.code).toBe('rate_limited');
  expect(err.message).toBe(t('errors.api.evaluate.rateLimited'));
});

it('maps a network failure to ai_failed with the connection message', async () => {
  fetchMock.mockRejectedValue(new TypeError('Network request failed'));
  const err = await evaluateConsolidation(req).catch((e) => e);
  expect(err).toBeInstanceOf(EvaluateApiError);
  expect(err.code).toBe('ai_failed');
  expect(err.message).toBe('Nu ne-am putut conecta. Verifică internetul și încearcă din nou.');
});

it('maps an unparseable error body to ai_failed', async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => { throw new Error('x'); } });
  const err = await evaluateConsolidation(req).catch((e) => e);
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
  const pending = evaluateConsolidation(req).catch((e) => e);
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
  fetchMock.mockResolvedValue(json(200, { items: [] }));
  await evaluateConsolidation(req);
  expect(jest.getTimerCount()).toBe(0);
});

it('maps the 402 body to EvaluateApiError with required and balance', async () => {
  fetchMock.mockResolvedValue(
    json(402, { error: 'insufficient_credits', message: 'Nu ai destule credite.', required: 2, balance: 1 }),
  );
  const err = await evaluateConsolidation(req).catch((e) => e);
  expect(err).toBeInstanceOf(EvaluateApiError);
  expect(err.code).toBe('insufficient_credits');
  expect(err.required).toBe(2);
  expect(err.balance).toBe(1);
});

it('returns the credits field of a successful evaluation', async () => {
  const ok = { items: [], credits: { spent: 1, balance: 4 } };
  fetchMock.mockResolvedValue(json(200, ok));
  await expect(evaluateConsolidation(req)).resolves.toEqual(ok);
});

describe('a suspended student (403 suspended)', () => {
  const SUSPENDED = 'Contul tău este suspendat.';
  let unregister: () => void = () => {};
  afterEach(() => unregister());

  it('refreshes the profile through the registered refresher and throws the server message', async () => {
    const refresh = jest.fn().mockResolvedValue(null);
    unregister = registerProfileRefresh(refresh);
    fetchMock.mockResolvedValue(json(403, { error: 'suspended', message: SUSPENDED }));
    const err = await evaluateConsolidation(req).catch((e) => e);
    expect(err).toBeInstanceOf(EvaluateApiError);
    expect(err.code).toBe('suspended');
    expect(err.message).toBe(SUSPENDED);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('still throws the message when no refresher is registered or it fails', async () => {
    fetchMock.mockResolvedValue(json(403, { error: 'suspended', message: SUSPENDED }));
    await expect(evaluateConsolidation(req)).rejects.toMatchObject({ code: 'suspended', message: SUSPENDED });
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    unregister = registerProfileRefresh(jest.fn().mockRejectedValue(new Error('offline')));
    await expect(evaluateConsolidation(req)).rejects.toMatchObject({ code: 'suspended', message: SUSPENDED });
  });

  it('does not refresh the profile for other 403s', async () => {
    const refresh = jest.fn().mockResolvedValue(null);
    unregister = registerProfileRefresh(refresh);
    fetchMock.mockResolvedValue(json(403, { error: 'forbidden', message: 'Nu ai acces.' }));
    await expect(evaluateConsolidation(req)).rejects.toMatchObject({ code: 'forbidden' });
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('access expired mid-session (403 access_required)', () => {
  it('triggers the registered access refresh and throws the server message', async () => {
    const refresh = jest.fn().mockResolvedValue(undefined);
    const unregister = registerAccessRefresh(refresh);
    const profile = jest.fn().mockResolvedValue(null);
    const unregisterProfile = registerProfileRefresh(profile);
    fetchMock.mockResolvedValue(json(403, { error: 'access_required', message: 'Lecția face parte din accesul complet.' }));
    await expect(evaluateConsolidation(req)).rejects.toMatchObject({ code: 'access_required', message: 'Lecția face parte din accesul complet.' });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(profile).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
    unregister();
    unregisterProfile();
  });
});

describe('server error codes become catalog texts (the server message is not shown)', () => {
  afterEach(() => resetTexts());
  const SERVER = 'server text';

  it.each([
    ['empty', 'errors.api.evaluate.empty'],
    ['too_long', 'errors.api.tooLong'],
    ['not_found', 'errors.api.evaluate.notFound'],
    ['rate_limited', 'errors.api.evaluate.rateLimited'],
    ['insufficient_credits', 'errors.api.evaluate.insufficientCredits'],
    ['ai_failed', 'errors.api.evaluate.aiFailed'],
    ['bad_request', 'errors.api.badRequest'],
    ['suspended', 'errors.api.suspended'],
    ['access_required', 'errors.api.evaluate.accessRequired'],
    ['some_new_code', 'errors.api.generic'],
  ] as const)('evaluate %s → %s', async (code, key) => {
    fetchMock.mockResolvedValue(json(code === 'suspended' ? 403 : 400, { error: code, message: SERVER }));
    const err = await evaluateConsolidation(req).catch((e) => e);
    expect(err).toBeInstanceOf(EvaluateApiError);
    expect(err.code).toBe(code);
    expect(err.message).toBe(t(key, { max: MAX_ANSWER_CHARS }));
    expect(err.message).not.toBe(SERVER);
  });

  it('a 403 unauthorized body (not a 401) uses the unauthorized text', async () => {
    fetchMock.mockResolvedValue(json(403, { error: 'unauthorized', message: SERVER }));
    await expect(evaluateConsolidation(req)).rejects.toMatchObject({ message: 'Trebuie să fii autentificat.' });
  });

  it('too_long names the limit', async () => {
    fetchMock.mockResolvedValue(json(400, { error: 'too_long', message: SERVER }));
    await expect(evaluateConsolidation(req)).rejects.toMatchObject({ message: 'Textul depășește 3000 de caractere.' });
  });

  it('ai_failed after a refund says no credit was taken', async () => {
    fetchMock.mockResolvedValue(json(502, { error: 'ai_failed', message: SERVER, credits: { spent: 0, balance: 4 } }));
    const err = await evaluateConsolidation(req).catch((e) => e);
    expect(err.message).toBe('Verificarea nu a reușit. Nu ți-am luat niciun credit. Încearcă din nou.');
    expect(err.balance).toBe(4);
  });

  it('an admin override replaces the text', async () => {
    applyOverrides({ 'errors.api.evaluate.rateLimited': '[override]' });
    fetchMock.mockResolvedValue(json(429, { error: 'rate_limited', message: SERVER }));
    await expect(evaluateConsolidation(req)).rejects.toMatchObject({ message: '[override]' });
  });

  it('the app-made messages come from the texts too', async () => {
    applyOverrides({ 'errors.offline': '[offline]', 'errors.sessionExpired': '[expired]' });
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    await expect(evaluateConsolidation(req)).rejects.toMatchObject({ message: '[offline]' });
    mockToken.mockResolvedValue(null);
    await expect(evaluateConsolidation(req)).rejects.toMatchObject({ message: '[expired]' });
  });

  it.each([
    ['forbidden', 'errors.api.accountDelete.forbidden'],
    ['server_error', 'errors.api.accountDelete.serverError'],
    ['bad_request', 'errors.api.badRequest'],
    ['unauthorized', 'errors.api.unauthorized'],
    ['some_new_code', 'errors.api.generic'],
  ] as const)('account delete %s → %s', async (code, key) => {
    fetchMock.mockResolvedValue(json(403, { error: code, message: SERVER }));
    const err = await deleteAccount().catch((e) => e);
    expect(err).toBeInstanceOf(AccountDeleteApiError);
    expect(err.code).toBe(code);
    expect(err.message).toBe(t(key));
  });

  it('account delete: an admin override replaces the text', async () => {
    applyOverrides({ 'errors.api.accountDelete.forbidden': '[override]' });
    fetchMock.mockResolvedValue(json(403, { error: 'forbidden', message: SERVER }));
    await expect(deleteAccount()).rejects.toMatchObject({ message: '[override]' });
  });
});
