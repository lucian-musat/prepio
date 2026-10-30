import { evaluateEssay, EvaluateApiError, EVALUATE_TIMEOUT_MS } from './api';

const fetchMock = jest.fn();
const ORIGINAL_API_URL = process.env.EXPO_PUBLIC_API_URL;

beforeEach(() => {
  fetchMock.mockReset();
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
  expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
  expect(JSON.parse(init.body)).toEqual(req);
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
