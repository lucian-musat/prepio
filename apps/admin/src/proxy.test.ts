import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUser = vi.fn();
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser } }),
}));

import { config, proxy } from './proxy';

const req = (path: string) => new NextRequest(new URL(path, 'http://localhost:3000'));

beforeEach(() => {
  getUser.mockReset();
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

  it('lets an authenticated request through', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const res = await proxy(req('/'));
    expect(res.headers.get('location')).toBeNull();
    expect(res.status).toBe(200);
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
