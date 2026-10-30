import { beforeEach, describe, expect, it, vi } from 'vitest';

const createAdminClient = vi.fn();
const handleEvaluate = vi.fn();
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => createAdminClient() }));
vi.mock('@/lib/evaluate/openai', () => ({ createOpenAIEvaluator: vi.fn(() => vi.fn()) }));
vi.mock('@/lib/evaluate/handler', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/evaluate/handler')>()),
  handleEvaluate: (...args: unknown[]) => handleEvaluate(...args),
}));

import { OPTIONS, POST, maxDuration } from './route';

const ALLOWED = 'http://localhost:8081';
const ID = '11111111-1111-4111-8111-111111111111';
const ok = { grade: 7, gradeMin: 1, gradeMax: 10, summary: 'Bine.', suggestions: [] };

function post(opts: { origin?: string; contentType?: string | null; body?: string; ip?: string } = {}) {
  const headers = new Headers();
  if (opts.origin) headers.set('Origin', opts.origin);
  if (opts.contentType !== null) headers.set('Content-Type', opts.contentType ?? 'application/json');
  if (opts.ip) headers.set('X-Forwarded-For', opts.ip);
  return new Request('http://localhost:3000/api/evaluate', {
    method: 'POST',
    headers,
    body: opts.body ?? JSON.stringify({ exerciseId: ID, text: 'Un text.' }),
  });
}

beforeEach(() => {
  process.env.STUDENT_WEB_ORIGINS = ALLOWED;
  delete process.env.OPENAI_API_KEY;
  createAdminClient.mockReset().mockReturnValue({ rpc: vi.fn() });
  handleEvaluate.mockReset().mockResolvedValue({ status: 200, json: ok });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('/api/evaluate route', () => {
  it('allows up to 60 s on Vercel', () => {
    expect(maxDuration).toBe(60);
  });

  it('answers the preflight from an allowed origin with 204 and CORS headers', () => {
    const r = OPTIONS(new Request('http://localhost:3000/api/evaluate', { method: 'OPTIONS', headers: { Origin: ALLOWED } }));
    expect(r.status).toBe(204);
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED);
  });

  it('serves an allowed origin with CORS headers', async () => {
    const r = await POST(post({ origin: ALLOWED, ip: '1.2.3.4, 10.0.0.1' }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual(ok);
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED);
    expect(r.headers.get('Cache-Control')).toBe('no-store');
    expect(handleEvaluate).toHaveBeenCalledWith({ exerciseId: ID, text: 'Un text.' }, '1.2.3.4', expect.any(Object));
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
    expect(handleEvaluate).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it('requires a JSON content type (415)', async () => {
    for (const contentType of ['text/plain', 'application/x-www-form-urlencoded', null]) {
      const r = await POST(post({ origin: ALLOWED, contentType }));
      expect(r.status).toBe(415);
      expect(await r.json()).toEqual({ error: 'bad_request', message: 'Cerere invalidă.' });
      expect(r.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED);
    }
    expect(handleEvaluate).not.toHaveBeenCalled();
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
    handleEvaluate.mockRejectedValue(new Error('boom'));
    r = await POST(post({ origin: ALLOWED }));
    expect(r.status).toBe(502);
    expect(await r.json()).toEqual({ error: 'ai_failed', message: 'Evaluarea nu a reușit. Încearcă din nou.' });
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED);
  });
});
