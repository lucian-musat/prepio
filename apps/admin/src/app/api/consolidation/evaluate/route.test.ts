import { beforeEach, describe, expect, it, vi } from 'vitest';

const createAdminClient = vi.fn();
const handleConsolidationEvaluate = vi.fn();
const authenticateBearer = vi.fn();
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/bearer', () => ({ authenticateBearer: (...a: unknown[]) => authenticateBearer(...a) }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => createAdminClient() }));
vi.mock('@/lib/evaluate/openai', () => ({ createOpenAIEvaluator: vi.fn(() => vi.fn()) }));
vi.mock('@/lib/consolidation/handler', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/consolidation/handler')>()),
  handleConsolidationEvaluate: (...args: unknown[]) => handleConsolidationEvaluate(...args),
}));

import { OPTIONS, POST, maxDuration } from './route';

const ALLOWED = 'http://localhost:8081';
const ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '99999999-9999-4999-8999-999999999999';
const ok = { items: [] };

function post(opts: { origin?: string; contentType?: string | null; body?: string; token?: string | null } = {}) {
  const headers = new Headers();
  if (opts.origin) headers.set('Origin', opts.origin);
  if (opts.contentType !== null) headers.set('Content-Type', opts.contentType ?? 'application/json');
  if (opts.token !== null) headers.set('Authorization', `Bearer ${opts.token ?? 'jwt'}`);
  return new Request('http://localhost:3000/api/consolidation/evaluate', {
    method: 'POST',
    headers,
    body: opts.body ?? JSON.stringify({ exerciseId: ID, text: 'Un text.' }),
  });
}

beforeEach(() => {
  process.env.STUDENT_WEB_ORIGINS = ALLOWED;
  delete process.env.OPENAI_API_KEY;
  createAdminClient.mockReset().mockReturnValue({ rpc: vi.fn() });
  handleConsolidationEvaluate.mockReset().mockResolvedValue({ status: 200, json: ok });
  authenticateBearer.mockReset().mockResolvedValue({ userId: USER_ID });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('/api/consolidation/evaluate route', () => {
  it('allows up to 60 s on Vercel', () => {
    expect(maxDuration).toBe(60);
  });

  it('answers the preflight from an allowed origin with 204 and CORS headers', () => {
    const r = OPTIONS(new Request('http://localhost:3000/api/consolidation/evaluate', { method: 'OPTIONS', headers: { Origin: ALLOWED } }));
    expect(r.status).toBe(204);
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED);
    expect(r.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
  });

  it('serves an allowed origin with CORS headers, evaluating for the signed-in user', async () => {
    const r = await POST(post({ origin: ALLOWED, token: 'good.jwt' }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual(ok);
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED);
    expect(r.headers.get('Cache-Control')).toBe('no-store');
    expect(authenticateBearer).toHaveBeenCalledWith(expect.any(Request), expect.any(Object));
    expect(handleConsolidationEvaluate).toHaveBeenCalledWith({ exerciseId: ID, text: 'Un text.' }, USER_ID, expect.any(Object));
  });

  it('returns 401 unauthorized without a valid token, before evaluating', async () => {
    authenticateBearer.mockResolvedValue(null);
    for (const token of [null, 'bad.jwt']) {
      const r = await POST(post({ origin: ALLOWED, token }));
      expect(r.status).toBe(401);
      expect(await r.json()).toEqual({ error: 'unauthorized', message: 'Trebuie să fii autentificat.' });
      expect(r.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED);
    }
    expect(handleConsolidationEvaluate).not.toHaveBeenCalled();
  });

  it('answers an auth outage with 502, not 401 (the client must keep its session)', async () => {
    authenticateBearer.mockRejectedValue(new Error('auth down'));
    const r = await POST(post({ origin: ALLOWED }));
    expect(r.status).toBe(502);
    expect(await r.json()).toMatchObject({ error: 'ai_failed' });
    expect(handleConsolidationEvaluate).not.toHaveBeenCalled();
  });

  it('serves requests without an Origin header (native app)', async () => {
    const r = await POST(post());
    expect(r.status).toBe(200);
    expect(r.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('rejects a disallowed Origin with 403 before doing any work', async () => {
    const r = await POST(post({ origin: 'https://evil.example' }));
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ error: 'bad_request', message: 'Cerere nepermisă.' });
    expect(r.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(handleConsolidationEvaluate).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it('requires a JSON content type (415)', async () => {
    for (const contentType of ['text/plain', 'application/x-www-form-urlencoded', null]) {
      const r = await POST(post({ origin: ALLOWED, contentType }));
      expect(r.status).toBe(415);
      expect(await r.json()).toEqual({ error: 'bad_request', message: 'Cerere invalidă.' });
      expect(r.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED);
    }
    expect(handleConsolidationEvaluate).not.toHaveBeenCalled();
  });

  it('accepts application/json with a charset', async () => {
    const r = await POST(post({ contentType: 'application/json; charset=utf-8' }));
    expect(r.status).toBe(200);
  });

  it('returns 400 for an unparseable JSON body', async () => {
    const r = await POST(post({ origin: ALLOWED, body: '{nope' }));
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ error: 'bad_request' });
  });

  it('turns an unexpected failure into 502 ai_failed with CORS headers', async () => {
    createAdminClient.mockImplementation(() => {
      throw new Error('supabaseUrl is required');
    });
    let r = await POST(post({ origin: ALLOWED }));
    expect(r.status).toBe(502);
    expect(await r.json()).toEqual({ error: 'ai_failed', message: 'Evaluarea nu a reușit. Încearcă din nou.' });
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED);

    createAdminClient.mockReturnValue({ rpc: vi.fn() });
    handleConsolidationEvaluate.mockRejectedValue(new Error('boom'));
    r = await POST(post({ origin: ALLOWED }));
    expect(r.status).toBe(502);
    expect(await r.json()).toEqual({ error: 'ai_failed', message: 'Evaluarea nu a reușit. Încearcă din nou.' });
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED);
  });
});
