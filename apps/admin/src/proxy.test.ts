import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type CookieAdapter = {
  setAll: (c: { name: string; value: string; options?: Record<string, unknown> }[]) => void;
};
const getUser = vi.fn();
const rpc = vi.fn();
const signOut = vi.fn();
let cookieAdapter: CookieAdapter;
vi.mock('@supabase/ssr', () => ({
  createServerClient: (_url: string, _key: string, opts: { cookies: CookieAdapter }) => {
    cookieAdapter = opts.cookies;
    return { auth: { getUser, signOut }, rpc };
  },
}));

import { config, proxy } from './proxy';

const req = (path: string) => new NextRequest(new URL(path, 'http://localhost:3000'));

beforeEach(() => {
  getUser.mockReset();
  rpc.mockReset();
  signOut.mockReset();
  // Like supabase-js, signOut() clears the session cookies through the adapter.
  signOut.mockImplementation(async () => {
    cookieAdapter.setAll([{ name: 'sb-auth-token', value: '', options: { maxAge: 0, path: '/' } }]);
    return { error: null };
  });
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
});

describe('proxy (auth gate)', () => {
  it('redirects an unauthenticated request to /login (307)', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await proxy(req('/'));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login');
  });

  it('lets /login through without a session', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await proxy(req('/login'));
    expect(res.headers.get('location')).toBeNull();
    expect(res.status).toBe(200);
  });

  it('lets /api/evaluate through without a session', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await proxy(req('/api/evaluate'));
    expect(res.headers.get('location')).toBeNull();
    expect(res.status).toBe(200);
  });

  it('lets an authenticated admin through', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    rpc.mockResolvedValue({ data: true, error: null });
    const res = await proxy(req('/'));
    expect(rpc).toHaveBeenCalledWith('is_admin');
    expect(signOut).not.toHaveBeenCalled();
    expect(res.headers.get('location')).toBeNull();
    expect(res.status).toBe(200);
  });

  it('signs out a non-admin and redirects to /login?error=not_admin with the cleared cookies', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'student' } } });
    rpc.mockResolvedValue({ data: false, error: null });
    const res = await proxy(req('/'));
    expect(signOut).toHaveBeenCalled();
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get('location')!);
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('error')).toBe('not_admin');
    const cleared = res.cookies.get('sb-auth-token');
    expect(cleared?.value).toBe('');
    expect(cleared?.maxAge).toBe(0);
  });

  it('treats an is_admin RPC error as not admin', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const res = await proxy(req('/lessons/1'));
    expect(signOut).toHaveBeenCalled();
    expect(new URL(res.headers.get('location')!).searchParams.get('error')).toBe('not_admin');
  });

  it('keeps /api/* public for a signed-in non-admin (no is_admin check)', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'student' } } });
    rpc.mockResolvedValue({ data: false, error: null });
    const res = await proxy(req('/api/evaluate'));
    expect(rpc).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
    expect(res.headers.get('location')).toBeNull();
    expect(res.status).toBe(200);
  });

  it('lets a signed-in non-admin see /login without signing them out', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'student' } } });
    rpc.mockResolvedValue({ data: false, error: null });
    const res = await proxy(req('/login?error=not_admin'));
    expect(signOut).not.toHaveBeenCalled();
    expect(res.headers.get('location')).toBeNull();
  });

  it('matcher excludes Next static assets and the favicon', () => {
    const re = new RegExp(`^${config.matcher[0]}$`);
    expect(re.test('/_next/static/chunks/a.js')).toBe(false);
    expect(re.test('/_next/image')).toBe(false);
    expect(re.test('/favicon.ico')).toBe(false);
    expect(re.test('/')).toBe(true);
    expect(re.test('/lessons/1')).toBe(true);
  });
});
