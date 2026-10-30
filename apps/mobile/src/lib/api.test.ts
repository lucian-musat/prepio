import { evaluateEssay, EvaluateApiError } from './api';

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

const req = { exerciseId: 'e1', text: 'Eseu' };
const json = (status: number, body: unknown) => ({ ok: status < 300, status, json: async () => body });

it('posts JSON and returns the parsed response', async () => {
  const ok = { grade: 8, gradeMin: 1, gradeMax: 10, summary: 'Bine', suggestions: ['a'] };
  fetchMock.mockResolvedValue(json(200, ok));
  await expect(evaluateEssay(req)).resolves.toEqual(ok);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('http://localhost:3000/api/evaluate');
  expect(init.method).toBe('POST');
  expect(JSON.parse(init.body)).toEqual(req);
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
