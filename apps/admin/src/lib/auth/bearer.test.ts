import { describe, expect, it, vi } from 'vitest';
import { AuthSessionMissingError, type SupabaseClient } from '@supabase/supabase-js';
import { authenticateBearer } from './bearer';

const USER_ID = '11111111-1111-4111-8111-111111111111';

function fakeDb(getUser: (jwt: string) => Promise<unknown>) {
  const spy = vi.fn(getUser);
  return { db: { auth: { getUser: spy } } as unknown as SupabaseClient, getUser: spy };
}

const valid = () => fakeDb(async (jwt) =>
  jwt === 'good.jwt'
    ? { data: { user: { id: USER_ID } }, error: null }
    : { data: { user: null }, error: { message: 'invalid JWT', status: 403, code: 'bad_jwt' } },
);

function req(authorization?: string) {
  const headers = new Headers();
  if (authorization !== undefined) headers.set('Authorization', authorization);
  return new Request('http://localhost:3000/api/x', { method: 'POST', headers });
}

describe('authenticateBearer', () => {
  it('returns null without an Authorization header, without calling auth', async () => {
    const { db, getUser } = valid();
    expect(await authenticateBearer(req(), db)).toBeNull();
    expect(getUser).not.toHaveBeenCalled();
  });

  it('returns null for a non-Bearer scheme or an empty token', async () => {
    const { db, getUser } = valid();
    for (const h of ['Basic good.jwt', 'good.jwt', 'Bearer', 'Bearer   ']) {
      expect(await authenticateBearer(req(h), db)).toBeNull();
    }
    expect(getUser).not.toHaveBeenCalled();
  });

  it('returns null for an invalid token', async () => {
    const { db } = valid();
    expect(await authenticateBearer(req('Bearer bad.jwt'), db)).toBeNull();
  });

  it('returns null when Supabase rejects the token itself (bad_jwt, session/user gone, session expired)', async () => {
    for (const [status, code] of [
      [403, 'bad_jwt'],
      [401, 'bad_jwt'],
      [403, 'user_not_found'],
      [404, 'user_not_found'],
      [403, 'session_expired'],
      [403, 'session_not_found'],
    ] as const) {
      const { db } = fakeDb(async () => ({ data: { user: null }, error: { message: 'rejected', status, code } }));
      expect(await authenticateBearer(req('Bearer x.jwt'), db)).toBeNull();
    }
  });

  it('throws (5xx, not a logout) when the server key is wrong: 401 "Invalid API key" carries no token error code', async () => {
    for (const code of [undefined, 'no_authorization', 'unexpected_failure']) {
      const { db } = fakeDb(async () => ({ data: { user: null }, error: { message: 'Invalid API key', status: 401, code } }));
      await expect(authenticateBearer(req('Bearer good.jwt'), db)).rejects.toThrow('Invalid API key');
    }
  });

  it('throws for a 403 without a token error code (e.g. a proxy/WAF block)', async () => {
    const { db } = fakeDb(async () => ({ data: { user: null }, error: { message: 'forbidden', status: 403 } }));
    await expect(authenticateBearer(req('Bearer good.jwt'), db)).rejects.toThrow();
  });

  it('returns null for a revoked session (auth-js maps session_not_found to AuthSessionMissingError, status 400)', async () => {
    const { db } = fakeDb(async () => ({ data: { user: null }, error: new AuthSessionMissingError() }));
    expect(await authenticateBearer(req('Bearer x.jwt'), db)).toBeNull();
  });

  it('returns null when Supabase answers without error but without a user', async () => {
    const { db } = fakeDb(async () => ({ data: { user: null }, error: null }));
    expect(await authenticateBearer(req('Bearer x.jwt'), db)).toBeNull();
  });

  it('throws (auth outage, not a logout) when auth throws', async () => {
    const { db } = fakeDb(async () => {
      throw new Error('network down');
    });
    await expect(authenticateBearer(req('Bearer good.jwt'), db)).rejects.toThrow('network down');
  });

  it('throws when Supabase returns a non-auth error (network status 0, 5xx, unknown)', async () => {
    for (const status of [0, 500, 502, undefined]) {
      const { db } = fakeDb(async () => ({ data: { user: null }, error: { message: 'upstream', status } }));
      await expect(authenticateBearer(req('Bearer good.jwt'), db)).rejects.toThrow();
    }
  });

  it('returns the user id for a valid token (scheme is case-insensitive)', async () => {
    const { db, getUser } = valid();
    expect(await authenticateBearer(req('Bearer good.jwt'), db)).toEqual({ userId: USER_ID });
    expect(await authenticateBearer(req('bearer  good.jwt '), db)).toEqual({ userId: USER_ID });
    expect(getUser).toHaveBeenCalledWith('good.jwt');
  });
});
