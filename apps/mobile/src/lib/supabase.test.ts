import { createClient } from '@supabase/supabase-js';
import { AUTH_TIMEOUT_MS, AuthOutageError, getAccessToken, isAuthRejection, withTimeout } from './supabase';

const mockGetSession = jest.fn();
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => ({ auth: { getSession: mockGetSession } })) }));

beforeAll(() => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://supabase.test';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon';
});
beforeEach(() => mockGetSession.mockReset());
afterEach(() => jest.useRealTimers());

describe('getAccessToken', () => {
  it('returns the current token', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'tok' } }, error: null });
    await expect(getAccessToken()).resolves.toBe('tok');
    expect(createClient).toHaveBeenCalledWith(
      'http://supabase.test',
      'anon',
      expect.objectContaining({ auth: expect.objectContaining({ persistSession: true, autoRefreshToken: true }) }),
    );
  });

  it('uses the PKCE flow (web Google redirect returns ?code=, exchanged by detectSessionInUrl)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'tok' } }, error: null });
    await getAccessToken();
    expect(createClient).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ auth: expect.objectContaining({ flowType: 'pkce' }) }),
    );
  });

  it('returns null when there is no session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(getAccessToken()).resolves.toBeNull();
  });

  it('returns null when Supabase rejected the refresh (session removed)', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: { name: 'AuthApiError', status: 400, message: 'Invalid Refresh Token' },
    });
    await expect(getAccessToken()).resolves.toBeNull();
  });

  it('throws AuthOutageError when an expired token cannot be refreshed offline (session kept in storage)', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: { name: 'AuthRetryableFetchError', status: 0, message: 'Network request failed' },
    });
    await expect(getAccessToken()).rejects.toBeInstanceOf(AuthOutageError);
  });

  it('throws AuthOutageError when getSession stalls', async () => {
    jest.useFakeTimers();
    mockGetSession.mockReturnValue(new Promise(() => {}));
    const pending = getAccessToken().catch((e) => e);
    await jest.advanceTimersByTimeAsync(AUTH_TIMEOUT_MS);
    expect(await pending).toBeInstanceOf(AuthOutageError);
  });
});

describe('withTimeout / isAuthRejection', () => {
  it('passes a fast result through and clears its timer', async () => {
    jest.useFakeTimers();
    await expect(withTimeout(Promise.resolve(1), 100)).resolves.toBe(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('classifies rejections vs outages', () => {
    expect(isAuthRejection({ name: 'AuthSessionMissingError', status: 400 })).toBe(true);
    expect(isAuthRejection({ name: 'AuthApiError', status: 403 })).toBe(true);
    expect(isAuthRejection({ name: 'AuthApiError', status: 401 })).toBe(true);
    expect(isAuthRejection({ name: 'AuthRetryableFetchError', status: 0 })).toBe(false);
    expect(isAuthRejection({ name: 'AuthRetryableFetchError', status: 503 })).toBe(false);
    expect(isAuthRejection({ name: 'AuthApiError', status: 429 })).toBe(false);
    expect(isAuthRejection({ name: 'AuthOutageError' })).toBe(false);
  });
});
