import { beforeEach, describe, expect, it, vi } from 'vitest';

const createAdminClient = vi.fn();
const authenticateBearer = vi.fn();
const deleteAccount = vi.fn();
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => createAdminClient() }));
vi.mock('@/lib/auth/bearer', () => ({ authenticateBearer: (...a: unknown[]) => authenticateBearer(...a) }));
vi.mock('@/lib/account/deleteAccount', () => ({ deleteAccount: (...a: unknown[]) => deleteAccount(...a) }));

import { OPTIONS, POST } from './route';

const ALLOWED = 'http://localhost:8081';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const db = { tag: 'service-db' };

function post(opts: { origin?: string; token?: string } = {}) {
  const headers = new Headers();
  if (opts.origin) headers.set('Origin', opts.origin);
  if (opts.token) headers.set('Authorization', `Bearer ${opts.token}`);
  return new Request('http://localhost:3000/api/account/delete', { method: 'POST', headers });
}

beforeEach(() => {
  process.env.STUDENT_WEB_ORIGINS = ALLOWED;
  createAdminClient.mockReset().mockReturnValue(db);
  authenticateBearer.mockReset().mockResolvedValue({ userId: USER_ID });
  deleteAccount.mockReset().mockResolvedValue('deleted');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('/api/account/delete route', () => {
  it('answers the preflight from an allowed origin with 204 and CORS headers incl. Authorization', () => {
    const r = OPTIONS(
      new Request('http://localhost:3000/api/account/delete', { method: 'OPTIONS', headers: { Origin: ALLOWED } }),
    );
    expect(r.status).toBe(204);
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED);
    expect(r.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
  });

  it('deletes the signed-in student with 204 and CORS headers (no body, no content type needed)', async () => {
    const r = await POST(post({ origin: ALLOWED, token: 'jwt' }));
    expect(r.status).toBe(204);
    expect(await r.text()).toBe('');
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED);
    expect(r.headers.get('Cache-Control')).toBe('no-store');
    expect(authenticateBearer).toHaveBeenCalledWith(expect.any(Request), db);
    expect(deleteAccount).toHaveBeenCalledWith(USER_ID, db);
  });

  it('serves requests without an Origin header (native app)', async () => {
    const r = await POST(post({ token: 'jwt' }));
    expect(r.status).toBe(204);
    expect(r.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('returns 401 unauthorized without a valid token', async () => {
    authenticateBearer.mockResolvedValue(null);
    const r = await POST(post({ origin: ALLOWED }));
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ error: 'unauthorized', message: 'Trebuie să fii autentificat.' });
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED);
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('returns 403 forbidden for an admin account', async () => {
    deleteAccount.mockResolvedValue('forbidden_admin');
    const r = await POST(post({ origin: ALLOWED, token: 'jwt' }));
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ error: 'forbidden', message: 'Contul de administrator nu poate fi șters de aici.' });
  });

  it('rejects a disallowed Origin with 403 before doing any work', async () => {
    const r = await POST(post({ origin: 'https://evil.example', token: 'jwt' }));
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ error: 'bad_request', message: 'Cerere nepermisă.' });
    expect(r.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('turns an unexpected failure into 500 with CORS headers', async () => {
    deleteAccount.mockRejectedValue(new Error('boom'));
    const r = await POST(post({ origin: ALLOWED, token: 'jwt' }));
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ error: 'server_error', message: 'Contul nu a putut fi șters. Încearcă din nou.' });
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED);
  });
});
