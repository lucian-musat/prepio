import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { authenticateBearer } from './bearer';

const USER_ID = '11111111-1111-4111-8111-111111111111';

function fakeDb(getUser: (jwt: string) => Promise<unknown>) {
  const spy = vi.fn(getUser);
  return { db: { auth: { getUser: spy } } as unknown as SupabaseClient, getUser: spy };
}

const valid = () => fakeDb(async (jwt) =>
  jwt === 'good.jwt'
    ? { data: { user: { id: USER_ID } }, error: null }
    : { data: { user: null }, error: { message: 'invalid JWT' } },
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

  it('returns null when auth throws', async () => {
    const { db } = fakeDb(async () => {
      throw new Error('network down');
    });
    expect(await authenticateBearer(req('Bearer good.jwt'), db)).toBeNull();
  });

  it('returns the user id for a valid token (scheme is case-insensitive)', async () => {
    const { db, getUser } = valid();
    expect(await authenticateBearer(req('Bearer good.jwt'), db)).toEqual({ userId: USER_ID });
    expect(await authenticateBearer(req('bearer  good.jwt '), db)).toEqual({ userId: USER_ID });
    expect(getUser).toHaveBeenCalledWith('good.jwt');
  });
});
