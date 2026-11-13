import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { getSupabase } from '../lib/supabase';
import { googleSignInError } from './googleCommon';
// Jest runs with the native platform, so './google' resolves to google.native.ts.
import { signInWithGoogle, signOutGoogle } from './google';
import * as web from './google.web';

jest.mock('../lib/supabase', () => ({
  ...jest.requireActual('../lib/supabase'),
  getSupabase: jest.fn(),
}));

const mockGoogle = GoogleSignin as unknown as Record<'configure' | 'hasPlayServices' | 'signIn' | 'signOut', jest.Mock>;
let auth: Record<string, jest.Mock>;

const nativeError = (code: string) => Object.assign(new Error(code), { code });

beforeEach(() => {
  jest.clearAllMocks();
  auth = {
    signInWithIdToken: jest.fn().mockResolvedValue({ data: { session: {} }, error: null }),
    signInWithOAuth: jest.fn().mockResolvedValue({ data: { url: 'https://example.test' }, error: null }),
  };
  (getSupabase as jest.Mock).mockReturnValue({ auth });
  mockGoogle.hasPlayServices.mockResolvedValue(true);
  mockGoogle.signIn.mockResolvedValue({ type: 'success', data: { idToken: 'google-id-token', user: {} } });
  mockGoogle.signOut.mockResolvedValue(null);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('signInWithGoogle (native)', () => {
  it('configures Google with the web client id and passes the id token to Supabase', async () => {
    await expect(signInWithGoogle()).resolves.toBe('ok');
    expect(mockGoogle.configure).toHaveBeenCalledWith(
      expect.objectContaining({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID }),
    );
    expect(auth.signInWithIdToken).toHaveBeenCalledWith({ provider: 'google', token: 'google-id-token' });
  });

  it('configures Google only once', async () => {
    let fresh!: { signInWithGoogle: typeof signInWithGoogle; signOutGoogle: typeof signOutGoogle };
    let freshGoogle!: typeof mockGoogle;
    jest.isolateModules(() => {
      fresh = require('./google');
      freshGoogle = require('@react-native-google-signin/google-signin').GoogleSignin;
      (require('../lib/supabase').getSupabase as jest.Mock).mockReturnValue({ auth });
    });
    await fresh.signInWithGoogle();
    await fresh.signInWithGoogle();
    await fresh.signOutGoogle();
    expect(freshGoogle.configure).toHaveBeenCalledTimes(1);
  });

  it('returns cancelled, without an error or a Supabase call, when the student closes the picker', async () => {
    mockGoogle.signIn.mockResolvedValue({ type: 'cancelled', data: null });
    await expect(signInWithGoogle()).resolves.toBe('cancelled');
    expect(auth.signInWithIdToken).not.toHaveBeenCalled();
  });

  it('treats the SIGN_IN_CANCELLED status code as cancelled', async () => {
    mockGoogle.signIn.mockRejectedValue(nativeError(statusCodes.SIGN_IN_CANCELLED));
    await expect(signInWithGoogle()).resolves.toBe('cancelled');
    expect(auth.signInWithIdToken).not.toHaveBeenCalled();
  });

  it('throws the Romanian error when Google returns no id token', async () => {
    mockGoogle.signIn.mockResolvedValue({ type: 'success', data: { idToken: null, user: {} } });
    await expect(signInWithGoogle()).rejects.toThrow(googleSignInError());
    expect(auth.signInWithIdToken).not.toHaveBeenCalled();
  });

  it('throws the Romanian error when Supabase rejects the token', async () => {
    auth.signInWithIdToken.mockResolvedValue({ data: { session: null }, error: new Error('invalid token') });
    await expect(signInWithGoogle()).rejects.toThrow(googleSignInError());
  });

  it('throws the Romanian error on other native failures', async () => {
    mockGoogle.signIn.mockRejectedValue(nativeError(statusCodes.PLAY_SERVICES_NOT_AVAILABLE));
    await expect(signInWithGoogle()).rejects.toThrow(googleSignInError());
  });

  it('uses the exact Romanian message', () => {
    expect(googleSignInError()).toBe('Intrarea cu Google nu a reușit. Încearcă din nou.');
  });
});

describe('signOutGoogle (native)', () => {
  it('signs out of Google', async () => {
    await signOutGoogle();
    expect(mockGoogle.signOut).toHaveBeenCalledTimes(1);
  });

  it('never throws', async () => {
    mockGoogle.signOut.mockRejectedValue(new Error('not signed in'));
    await expect(signOutGoogle()).resolves.toBeUndefined();
  });
});

describe('signInWithGoogle (web)', () => {
  // Jest runs the native environment, which has no `window`.
  const g = globalThis as { window?: unknown };
  const hadWindow = 'window' in g;
  const originalWindow = g.window;
  beforeEach(() => {
    g.window = { location: { origin: 'http://localhost:8081' } };
  });
  afterEach(() => {
    if (hadWindow) g.window = originalWindow;
    else delete g.window;
  });

  it('redirects to Google through Supabase OAuth, coming back to this origin', async () => {
    await expect(web.signInWithGoogle()).resolves.toBe('ok');
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'http://localhost:8081' },
    });
    expect(mockGoogle.signIn).not.toHaveBeenCalled();
  });

  it('throws the Romanian error when Supabase cannot start the redirect', async () => {
    auth.signInWithOAuth.mockResolvedValue({ data: { url: null }, error: new Error('provider disabled') });
    await expect(web.signInWithGoogle()).rejects.toThrow(googleSignInError());
  });

  it('signOutGoogle is a no-op on web', async () => {
    await expect(web.signOutGoogle()).resolves.toBeUndefined();
    expect(mockGoogle.signOut).not.toHaveBeenCalled();
  });
});
