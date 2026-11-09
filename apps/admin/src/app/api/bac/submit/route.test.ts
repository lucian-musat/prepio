import { beforeEach, describe, expect, it, vi } from 'vitest';

const createAdminClient = vi.fn();
const handleBacSubmit = vi.fn();
const authenticateBearer = vi.fn();
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/bearer', () => ({ authenticateBearer: (...a: unknown[]) => authenticateBearer(...a) }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => createAdminClient() }));
vi.mock('@/lib/evaluate/openai', () => ({ createOpenAIGrader: vi.fn(() => vi.fn()) }));
vi.mock('@/lib/bac/handler', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/bac/handler')>()),
  handleBacSubmit: (...args: unknown[]) => handleBacSubmit(...args),
}));

import { POST, maxDuration } from './route';

const ALLOWED = 'http://localhost:8081';
const USER_ID = '99999999-9999-4999-8999-999999999999';
const REQUEST = { subjectId: '11111111-1111-4111-8111-111111111111', answers: {} };

function post(opts: { origin?: string; contentType?: string; body?: string } = {}) {
  const headers = new Headers({ 'Content-Type': opts.contentType ?? 'application/json', Authorization: 'Bearer jwt' });
  if (opts.origin) headers.set('Origin', opts.origin);
  return new Request('http://localhost:3000/api/bac/submit', { method: 'POST', headers, body: opts.body ?? JSON.stringify(REQUEST) });
}

beforeEach(() => {
  process.env.STUDENT_WEB_ORIGINS = ALLOWED;
  delete process.env.OPENAI_API_KEY;
  createAdminClient.mockReset().mockReturnValue({ rpc: vi.fn() });
  handleBacSubmit.mockReset().mockResolvedValue({ status: 200, json: { ok: true } });
  authenticateBearer.mockReset().mockResolvedValue({ userId: USER_ID });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('/api/bac/submit route', () => {
  it('allows up to 60 s on Vercel', () => {
    expect(maxDuration).toBe(60);
  });

  it('grades for the signed-in user with CORS headers', async () => {
    const r = await POST(post({ origin: ALLOWED }));
    expect(r.status).toBe(200);
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED);
    expect(r.headers.get('Cache-Control')).toBe('no-store');
    expect(handleBacSubmit).toHaveBeenCalledWith(REQUEST, USER_ID, expect.any(Object));
  });

  it('refuses a foreign origin, a non-JSON body and a missing session before grading', async () => {
    expect((await POST(post({ origin: 'https://evil.example' }))).status).toBe(403);
    expect((await POST(post({ contentType: 'text/plain' }))).status).toBe(415);
    expect((await POST(post({ body: '{' }))).status).toBe(400);
    authenticateBearer.mockResolvedValue(null);
    const r = await POST(post());
    expect(r.status).toBe(401);
    expect(await r.json()).toMatchObject({ error: 'unauthorized' });
    expect(handleBacSubmit).not.toHaveBeenCalled();
  });

  it('answers an unexpected failure with grading_failed', async () => {
    handleBacSubmit.mockRejectedValue(new Error('boom'));
    const r = await POST(post());
    expect(r.status).toBe(502);
    expect(await r.json()).toMatchObject({ error: 'grading_failed' });
  });
});
