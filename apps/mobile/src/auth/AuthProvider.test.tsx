import { act, render, screen, waitFor } from '@testing-library/react-native';
import { AppState, Text } from 'react-native';
import { AuthProvider, statusFor, useAuth } from './AuthProvider';
import { fetchProfile } from '../lib/profile';
import { AUTH_TIMEOUT_MS, getSupabase, signOut as libSignOut } from '../lib/supabase';
import { signOutGoogle } from './google';
import { localDay, logAppOpen } from '../lib/activity';
import { refreshRegisteredProfile } from '../lib/profileRefresh';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { acceptTerms, getStoredConsent, storeConsent } from '../lib/termsConsent';
import { TERMS_VERSION as TV } from '../lib/legal';

jest.mock('../lib/profile', () => ({ fetchProfile: jest.fn() }));
jest.mock('../lib/termsConsent', () => ({ ...jest.requireActual('../lib/termsConsent'), acceptTerms: jest.fn() }));
jest.mock('../lib/activity', () => ({ logAppOpen: jest.fn(), localDay: jest.fn() }));
jest.mock('./google', () => ({ signOutGoogle: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../lib/supabase', () => ({
  ...jest.requireActual('../lib/supabase'),
  getSupabase: jest.fn(),
  signOut: jest.fn(),
}));

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const session = (id = USER, token = 'access-1') => ({ access_token: token, user: { id } });

type Listener = (event: string, s: unknown) => void;
let listeners: Listener[];
let auth: Record<string, jest.Mock>;

const mockFetchProfile = fetchProfile as jest.Mock;
const mockLibSignOut = libSignOut as jest.Mock;

async function emit(event: string, s: unknown) {
  await act(async () => {
    for (const l of [...listeners]) l(event, s);
  });
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  (acceptTerms as jest.Mock).mockResolvedValue(undefined);
  listeners = [];
  auth = {
    getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    getUser: jest.fn().mockResolvedValue({ data: { user: { id: USER } }, error: null }),
    onAuthStateChange: jest.fn((cb: Listener) => {
      listeners.push(cb);
      return { data: { subscription: { unsubscribe: jest.fn(() => (listeners = listeners.filter((l) => l !== cb))) } } };
    }),
    startAutoRefresh: jest.fn(),
    stopAutoRefresh: jest.fn(),
  };
  (getSupabase as jest.Mock).mockReturnValue({ auth });
  // The real lib signOut clears the stored session, which makes Supabase emit SIGNED_OUT.
  mockLibSignOut.mockImplementation(async () => {
    for (const l of [...listeners]) l('SIGNED_OUT', null);
  });
  mockFetchProfile.mockResolvedValue({ id: USER, displayName: 'Ana', learningMode: 'guided', creditBalance: 5, termsVersion: TV, suspendedReason: null, accessUntil: null });
  (logAppOpen as jest.Mock).mockResolvedValue(true);
  (localDay as jest.Mock).mockReturnValue('2026-11-06');
});

let latest: ReturnType<typeof useAuth>;
function Probe() {
  latest = useAuth();
  return (
    <Text testID="state">
      {latest.status}|{latest.profile?.displayName ?? '-'}|{latest.session?.access_token ?? '-'}
    </Text>
  );
}

const renderAuth = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

const state = () => screen.getByTestId('state').props.children.join('');
const waitForState = (expected: string) => waitFor(() => expect(state()).toBe(expected));

it('starts loading and becomes signedOut without a stored session', async () => {
  await renderAuth();
  await waitForState('signedOut|-|-');
  expect(auth.getUser).not.toHaveBeenCalled();
  expect(mockFetchProfile).not.toHaveBeenCalled();
});

it('is loading until the stored session is resolved', async () => {
  // Fake timers: the start-up timeout must not fire (and log) after the test run has finished.
  jest.useFakeTimers();
  try {
    auth.getSession.mockReturnValue(new Promise(() => {}));
    await renderAuth();
    expect(state()).toBe('loading|-|-');
  } finally {
    jest.useRealTimers();
  }
});

it('a session whose profile has no name → needsName', async () => {
  auth.getSession.mockResolvedValue({ data: { session: session() }, error: null });
  mockFetchProfile.mockResolvedValue({ id: USER, displayName: null, learningMode: null, creditBalance: 5, termsVersion: TV });
  await renderAuth();
  await waitForState('needsName|-|access-1');
  expect(mockFetchProfile).toHaveBeenCalledWith(USER);
});

it('a session without a profile row → needsName', async () => {
  auth.getSession.mockResolvedValue({ data: { session: session() }, error: null });
  mockFetchProfile.mockResolvedValue(null);
  await renderAuth();
  await waitForState('needsName|-|access-1');
});

it('a session with a named profile → ready', async () => {
  auth.getSession.mockResolvedValue({ data: { session: session() }, error: null });
  await renderAuth();
  await waitForState('ready|Ana|access-1');
});

it('a stored session of a deleted user (getUser rejects the token) → signedOut and the session is cleared', async () => {
  auth.getSession.mockResolvedValue({ data: { session: session() }, error: null });
  auth.getUser.mockResolvedValue({ data: { user: null }, error: { name: 'AuthApiError', message: 'User not found', status: 403 } });
  await renderAuth();
  await waitForState('signedOut|-|-');
  expect(mockLibSignOut).toHaveBeenCalledTimes(1);
  expect(mockFetchProfile).not.toHaveBeenCalled();
});

it('a revoked session (AuthSessionMissingError) → signedOut', async () => {
  auth.getSession.mockResolvedValue({ data: { session: session() }, error: null });
  auth.getUser.mockResolvedValue({
    data: { user: null },
    error: { name: 'AuthSessionMissingError', message: 'Auth session missing!', status: 400 },
  });
  mockLibSignOut.mockResolvedValue(undefined); // even if no SIGNED_OUT event arrives
  await renderAuth();
  await waitForState('signedOut|-|-');
  expect(mockLibSignOut).toHaveBeenCalledTimes(1);
});

it('a stale start-up rejection does not sign out a student who signed in meanwhile', async () => {
  let rejectUser!: (v: unknown) => void;
  auth.getSession.mockResolvedValue({ data: { session: session() }, error: null });
  auth.getUser.mockReturnValue(new Promise((r) => (rejectUser = r)));
  await renderAuth();
  await waitFor(() => expect(auth.getUser).toHaveBeenCalled());
  mockFetchProfile.mockResolvedValue({ id: OTHER, displayName: 'Ion', learningMode: 'guided', creditBalance: 5, termsVersion: TV });
  await emit('SIGNED_IN', session(OTHER, 'access-9'));
  await waitForState('ready|Ion|access-9');
  await act(async () =>
    rejectUser({ data: { user: null }, error: { name: 'AuthApiError', message: 'User not found', status: 403 } }),
  );
  expect(mockLibSignOut).not.toHaveBeenCalled();
  expect(state()).toBe('ready|Ion|access-9');
});

it('keeps the stored session when getUser fails for a network reason (offline start)', async () => {
  auth.getSession.mockResolvedValue({ data: { session: session() }, error: null });
  auth.getUser.mockResolvedValue({
    data: { user: null },
    error: { name: 'AuthRetryableFetchError', message: 'Network request failed', status: 0 },
  });
  await renderAuth();
  await waitForState('ready|Ana|access-1');
  expect(mockLibSignOut).not.toHaveBeenCalled();
});

it('a profile fetch failure keeps the student in (ready) rather than blocking on the name screen', async () => {
  auth.getSession.mockResolvedValue({ data: { session: session() }, error: null });
  mockFetchProfile.mockRejectedValue(new Error('offline'));
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  await renderAuth();
  await waitForState('ready|-|access-1');
});

it('SIGNED_OUT event → signedOut and the profile is dropped', async () => {
  auth.getSession.mockResolvedValue({ data: { session: session() }, error: null });
  await renderAuth();
  await waitForState('ready|Ana|access-1');
  await emit('SIGNED_OUT', null);
  await waitForState('signedOut|-|-');
});

it('SIGNED_IN event from signedOut loads the profile', async () => {
  await renderAuth();
  await waitForState('signedOut|-|-');
  mockFetchProfile.mockResolvedValue({ id: OTHER, displayName: null, learningMode: null, creditBalance: 5, termsVersion: TV });
  await emit('SIGNED_IN', session(OTHER, 'access-9'));
  await waitForState('needsName|-|access-9');
  expect(mockFetchProfile).toHaveBeenCalledWith(OTHER);
});

it('TOKEN_REFRESHED only swaps the session, without reloading the profile or leaving ready', async () => {
  auth.getSession.mockResolvedValue({ data: { session: session() }, error: null });
  await renderAuth();
  await waitForState('ready|Ana|access-1');
  mockFetchProfile.mockClear();
  await emit('TOKEN_REFRESHED', session(USER, 'access-2'));
  await waitForState('ready|Ana|access-2');
  expect(mockFetchProfile).not.toHaveBeenCalled();
});

it('refreshProfile moves needsName → ready once the name is saved', async () => {
  auth.getSession.mockResolvedValue({ data: { session: session() }, error: null });
  mockFetchProfile.mockResolvedValue({ id: USER, displayName: null, learningMode: null, creditBalance: 5, termsVersion: TV });
  await renderAuth();
  await waitForState('needsName|-|access-1');
  mockFetchProfile.mockResolvedValue({ id: USER, displayName: 'Ana', learningMode: 'guided', creditBalance: 5, termsVersion: TV });
  await act(() => latest.refreshProfile());
  expect(state()).toBe('ready|Ana|access-1');
});

it('refreshProfile moves needsMode → ready once the mode is saved', async () => {
  auth.getSession.mockResolvedValue({ data: { session: session() }, error: null });
  mockFetchProfile.mockResolvedValue({ id: USER, displayName: 'Ana', learningMode: null, creditBalance: 5, termsVersion: TV });
  await renderAuth();
  await waitForState('needsMode|Ana|access-1');
  mockFetchProfile.mockResolvedValue({ id: USER, displayName: 'Ana', learningMode: 'guided', creditBalance: 5, termsVersion: TV });
  await act(() => latest.refreshProfile());
  expect(state()).toBe('ready|Ana|access-1');
});

it('refreshProfile resolves with the profile it settled on', async () => {
  auth.getSession.mockResolvedValue({ data: { session: session() }, error: null });
  await renderAuth();
  await waitForState('ready|Ana|access-1');
  mockFetchProfile.mockResolvedValue({ id: USER, displayName: 'Ana', learningMode: 'free', creditBalance: 5, termsVersion: TV });
  let fresh: unknown;
  await act(async () => {
    fresh = await latest.refreshProfile();
  });
  expect(fresh).toEqual({ id: USER, displayName: 'Ana', learningMode: 'free', creditBalance: 5, termsVersion: TV });
});

it('refreshProfile resolves with the kept profile when the reload fails', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  auth.getSession.mockResolvedValue({ data: { session: session() }, error: null });
  await renderAuth();
  await waitForState('ready|Ana|access-1');
  mockFetchProfile.mockRejectedValue(new Error('offline'));
  let fresh: unknown;
  await act(async () => {
    fresh = await latest.refreshProfile();
  });
  expect(fresh).toEqual({ id: USER, displayName: 'Ana', learningMode: 'guided', creditBalance: 5, termsVersion: TV, suspendedReason: null, accessUntil: null });
  warn.mockRestore();
});

it('signOut() signs out through the shared lib signOut and ends signedOut', async () => {
  auth.getSession.mockResolvedValue({ data: { session: session() }, error: null });
  mockLibSignOut.mockResolvedValue(undefined);
  await renderAuth();
  await waitForState('ready|Ana|access-1');
  await act(() => latest.signOut());
  expect(mockLibSignOut).toHaveBeenCalledTimes(1);
  expect(state()).toBe('signedOut|-|-');
});

it('signOut() also signs out of Google (so the next sign-in shows the account picker)', async () => {
  auth.getSession.mockResolvedValue({ data: { session: session() }, error: null });
  await renderAuth();
  await waitForState('ready|Ana|access-1');
  await act(() => latest.signOut());
  expect(signOutGoogle).toHaveBeenCalledTimes(1);
  expect(state()).toBe('signedOut|-|-');
});

it('signOut() still signs out of Supabase when the Google sign-out fails', async () => {
  (signOutGoogle as jest.Mock).mockRejectedValueOnce(new Error('google down'));
  auth.getSession.mockResolvedValue({ data: { session: session() }, error: null });
  await renderAuth();
  await waitForState('ready|Ana|access-1');
  await act(() => latest.signOut());
  expect(mockLibSignOut).toHaveBeenCalledTimes(1);
  expect(state()).toBe('signedOut|-|-');
});

it('a slow initial load does not overwrite a newer auth event', async () => {
  let resolveSession!: (v: unknown) => void;
  auth.getSession.mockReturnValue(new Promise((r) => (resolveSession = r)));
  await renderAuth();
  await emit('SIGNED_OUT', null);
  await waitForState('signedOut|-|-');
  await act(async () => resolveSession({ data: { session: session() }, error: null }));
  expect(state()).toBe('signedOut|-|-');
});

it('on native, auto-refresh follows the app state and the listeners are removed on unmount', async () => {
  const remove = jest.fn();
  let onChange: (s: string) => void = () => {};
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, cb) => {
    onChange = cb as (s: string) => void;
    return { remove } as never;
  });
  const view = await renderAuth();
  await waitForState('signedOut|-|-');
  await act(async () => onChange('background'));
  expect(auth.stopAutoRefresh).toHaveBeenCalledTimes(1);
  await act(async () => onChange('active'));
  expect(auth.startAutoRefresh).toHaveBeenCalled();
  await view.unmount();
  expect(remove).toHaveBeenCalled();
  expect(listeners).toHaveLength(0);
});

describe('network outages are not a logout', () => {
  const offline = { name: 'AuthRetryableFetchError', message: 'Network request failed', status: 0 };
  const advance = (ms: number) => act(async () => void (await jest.advanceTimersByTimeAsync(ms)));
  afterEach(() => jest.useRealTimers());

  it('expired stored token + offline refresh at start-up → stays signed in (ready, no session yet)', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: offline });
    await renderAuth();
    await waitForState('ready|-|-');
    expect(mockLibSignOut).not.toHaveBeenCalled();
  });

  it('…and recovers the session and profile when the auto-refresh succeeds (TOKEN_REFRESHED)', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: offline });
    await renderAuth();
    await waitForState('ready|-|-');
    await emit('TOKEN_REFRESHED', session(USER, 'access-2'));
    await waitForState('ready|Ana|access-2');
    expect(mockFetchProfile).toHaveBeenCalledWith(USER);
  });

  it('a getSession that throws is treated as an outage, not a logout', async () => {
    auth.getSession.mockRejectedValue(new Error('storage exploded'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await renderAuth();
    await waitForState('ready|-|-');
    expect(mockLibSignOut).not.toHaveBeenCalled();
  });

  it('a TOKEN_REFRESHED while signedOut moves into the normal settle path', async () => {
    await renderAuth();
    await waitForState('signedOut|-|-');
    await emit('TOKEN_REFRESHED', session());
    await waitForState('ready|Ana|access-1');
  });

  it('refreshProfile in the offline state re-reads the stored session instead of signing out', async () => {
    auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: offline });
    await renderAuth();
    await waitForState('ready|-|-');
    auth.getSession.mockResolvedValue({ data: { session: session() }, error: null });
    await act(() => latest.refreshProfile());
    await waitForState('ready|Ana|access-1');
  });

  it('a stalled getSession at start-up times out into the offline state (splash does not hang)', async () => {
    jest.useFakeTimers();
    auth.getSession.mockReturnValue(new Promise(() => {}));
    await renderAuth();
    expect(state()).toBe('loading|-|-');
    await advance(AUTH_TIMEOUT_MS);
    expect(state()).toBe('ready|-|-');
    expect(mockLibSignOut).not.toHaveBeenCalled();
  });

  it('a getUser that never answers times out and keeps the stored session', async () => {
    jest.useFakeTimers();
    auth.getSession.mockResolvedValue({ data: { session: session() }, error: null });
    auth.getUser.mockReturnValue(new Promise(() => {}));
    await renderAuth();
    expect(state()).toBe('loading|-|-');
    await advance(AUTH_TIMEOUT_MS - 1);
    expect(state()).toBe('loading|-|-');
    await advance(1);
    expect(state()).toBe('ready|Ana|access-1');
    expect(mockLibSignOut).not.toHaveBeenCalled();
  });

  it('a profile load that never answers times out into ready without a profile', async () => {
    jest.useFakeTimers();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    auth.getSession.mockResolvedValue({ data: { session: session() }, error: null });
    mockFetchProfile.mockReturnValue(new Promise(() => {}));
    await renderAuth();
    await advance(AUTH_TIMEOUT_MS);
    expect(state()).toBe('ready|-|access-1');
  });

  it('ready without a profile retries the profile when the app returns to the foreground', async () => {
    let onChange: (s: string) => void = () => {};
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, cb) => {
      onChange = cb as (s: string) => void;
      return { remove: jest.fn() } as never;
    });
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    auth.getSession.mockResolvedValue({ data: { session: session() }, error: null });
    mockFetchProfile.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ id: USER, displayName: null, learningMode: null, creditBalance: 5, termsVersion: TV });
    await renderAuth();
    await waitForState('ready|-|access-1');
    await act(async () => onChange('active'));
    await waitForState('needsName|-|access-1');
  });

  it('ready without a profile retries the profile on the next auth event', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    auth.getSession.mockResolvedValue({ data: { session: session() }, error: null });
    mockFetchProfile.mockRejectedValueOnce(new Error('offline'));
    await renderAuth();
    await waitForState('ready|-|access-1');
    await emit('TOKEN_REFRESHED', session(USER, 'access-2'));
    await waitForState('ready|Ana|access-2');
  });

  it('back in the foreground after an offline start, re-reads the stored session', async () => {
    let onChange: (s: string) => void = () => {};
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, cb) => {
      onChange = cb as (s: string) => void;
      return { remove: jest.fn() } as never;
    });
    auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: offline });
    await renderAuth();
    await waitForState('ready|-|-');
    auth.getSession.mockResolvedValue({ data: { session: session() }, error: null });
    await act(async () => onChange('active'));
    await waitForState('ready|Ana|access-1');
  });
});

it('useAuth outside the provider throws', async () => {
  function Outside() {
    try {
      useAuth();
      return <Text testID="outside">no error</Text>;
    } catch (e) {
      return <Text testID="outside">{(e as Error).message}</Text>;
    }
  }
  await render(<Outside />);
  expect(screen.getByTestId('outside').props.children).toBe('useAuth must be used inside <AuthProvider>');
});

describe('statusFor', () => {
  it('asks for the name first, then the mode, then lets the student in', () => {
    expect(statusFor({ id: USER, displayName: null, learningMode: null, creditBalance: 5, termsVersion: TV, suspendedReason: null, accessUntil: null }, false)).toBe('needsName');
    expect(statusFor({ id: USER, displayName: 'Ana', learningMode: null, creditBalance: 5, termsVersion: TV, suspendedReason: null, accessUntil: null }, false)).toBe('needsMode');
    expect(statusFor({ id: USER, displayName: 'Ana', learningMode: 'guided', creditBalance: 5, termsVersion: TV, suspendedReason: null, accessUntil: null }, false)).toBe('ready');
    expect(statusFor({ id: USER, displayName: 'Ana', learningMode: 'free', creditBalance: 5, termsVersion: TV, suspendedReason: null, accessUntil: null }, false)).toBe('ready');
  });

  it('a suspended profile is suspended first, even without a name or mode', () => {
    const reason = 'Cont creat pentru test.';
    expect(statusFor({ id: USER, displayName: null, learningMode: null, creditBalance: 5, termsVersion: TV, suspendedReason: reason, accessUntil: null }, false)).toBe('suspended');
    expect(statusFor({ id: USER, displayName: 'Ana', learningMode: 'guided', creditBalance: 5, termsVersion: TV, suspendedReason: reason, accessUntil: null }, false)).toBe('suspended');
  });

  it('lets the student in when the profile could not be loaded', () => {
    expect(statusFor(null, true)).toBe('ready');
  });

  const base = { id: USER, displayName: 'Ana', learningMode: 'guided' as const, creditBalance: 5, suspendedReason: null, accessUntil: null };

  it('asks for the terms first when they were never accepted or are an older version', () => {
    expect(statusFor({ ...base, termsVersion: null }, false)).toBe('needsTerms');
    expect(statusFor({ ...base, termsVersion: '2020-01-01' }, false)).toBe('needsTerms');
    expect(statusFor({ ...base, displayName: null, learningMode: null, termsVersion: null }, false)).toBe('needsTerms');
  });

  it('a suspended profile with no terms is still suspended', () => {
    expect(statusFor({ ...base, termsVersion: null, suspendedReason: 'Motiv' }, false)).toBe('suspended');
  });

  it('a failed load without a profile still lets the student in (no gate offline)', () => {
    expect(statusFor(null, true)).toBe('ready');
  });

  it('accepted terms but no name → needsName', () => {
    expect(statusFor({ ...base, displayName: null, learningMode: null, termsVersion: TV }, false)).toBe('needsName');
  });
});

describe('terms consent', () => {
  const noTerms = { id: USER, displayName: 'Ana', learningMode: 'guided', creditBalance: 5, suspendedReason: null, accessUntil: null, termsVersion: null };
  let seen: string[];
  function Recorder() {
    const { status } = useAuth();
    seen.push(status);
    return null;
  }
  const renderRecorded = () =>
    render(
      <AuthProvider>
        <Probe />
        <Recorder />
      </AuthProvider>,
    );
  beforeEach(() => {
    seen = [];
  });

  it('a profile without accepted terms and no stored consent → needsTerms (no RPC)', async () => {
    auth.getSession.mockResolvedValue({ data: { session: session() }, error: null });
    mockFetchProfile.mockResolvedValue(noTerms);
    await renderAuth();
    await waitForState('needsTerms|Ana|access-1');
    expect(acceptTerms).not.toHaveBeenCalled();
  });

  it('a stored consent is accepted once after sign-in, cleared, and the gate never shows', async () => {
    await storeConsent(TV);
    mockFetchProfile.mockResolvedValue(noTerms);
    await renderRecorded();
    await waitForState('signedOut|-|-');
    await emit('SIGNED_IN', session());
    await waitForState('ready|Ana|access-1');
    expect(acceptTerms).toHaveBeenCalledTimes(1);
    expect(latest.profile?.termsVersion).toBe(TV);
    await expect(getStoredConsent()).resolves.toBeNull();
    expect(seen).not.toContain('needsTerms');
  });

  it('a new account with a stored consent goes straight to the name screen', async () => {
    await storeConsent(TV);
    mockFetchProfile.mockResolvedValue({ ...noTerms, displayName: null, learningMode: null });
    await renderRecorded();
    await waitForState('signedOut|-|-');
    await emit('SIGNED_IN', session());
    await waitForState('needsName|-|access-1');
    expect(seen).not.toContain('needsTerms');
  });

  it('a failed auto-accept settles on needsTerms (the gate)', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    (acceptTerms as jest.Mock).mockRejectedValue(new Error('terms_version_mismatch'));
    await storeConsent(TV);
    mockFetchProfile.mockResolvedValue(noTerms);
    await renderAuth();
    await waitForState('signedOut|-|-');
    await emit('SIGNED_IN', session());
    await waitForState('needsTerms|Ana|access-1');
    expect(acceptTerms).toHaveBeenCalledTimes(1);
  });

  it('a stale consent (left behind by a cancelled sign-in) is not recorded on the next account, and is removed', async () => {
    await AsyncStorage.setItem('prepio.termsConsent', JSON.stringify({ version: TV, at: Date.now() - 16 * 60_000 }));
    mockFetchProfile.mockResolvedValue({ ...noTerms, id: OTHER, displayName: 'Ion' });
    await renderAuth();
    await waitForState('signedOut|-|-');
    await emit('SIGNED_IN', session(OTHER, 'access-9'));
    await waitForState('needsTerms|Ion|access-9');
    expect(acceptTerms).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem('prepio.termsConsent')).toBeNull();
  });

  it('a consent stored for another terms version is not sent', async () => {
    await storeConsent('2020-01-01');
    auth.getSession.mockResolvedValue({ data: { session: session() }, error: null });
    mockFetchProfile.mockResolvedValue(noTerms);
    await renderAuth();
    await waitForState('needsTerms|Ana|access-1');
    expect(acceptTerms).not.toHaveBeenCalled();
  });

  it('a suspended student is not auto-accepted and stays suspended', async () => {
    await storeConsent(TV);
    auth.getSession.mockResolvedValue({ data: { session: session() }, error: null });
    mockFetchProfile.mockResolvedValue({ ...noTerms, suspendedReason: 'Motiv' });
    await renderAuth();
    await waitForState('suspended|Ana|access-1');
    expect(acceptTerms).not.toHaveBeenCalled();
  });

  it('a student who already accepted the current terms needs no RPC', async () => {
    await storeConsent(TV);
    auth.getSession.mockResolvedValue({ data: { session: session() }, error: null });
    await renderAuth();
    await waitForState('ready|Ana|access-1');
    expect(acceptTerms).not.toHaveBeenCalled();
  });

  it('signOut() clears the stored consent, so the next person on this device must tick it themselves', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    (acceptTerms as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await storeConsent(TV);
    mockFetchProfile.mockResolvedValue(noTerms);
    await renderAuth();
    await waitForState('signedOut|-|-');
    await emit('SIGNED_IN', session());
    await waitForState('needsTerms|Ana|access-1');
    // The first student leaves from the gate: the consent they gave on this device goes with them.
    await act(() => latest.signOut());
    await waitForState('signedOut|-|-');
    await expect(getStoredConsent()).resolves.toBeNull();
    // A second student signs in on the same device without ticking: the gate, no RPC on their behalf.
    (acceptTerms as jest.Mock).mockClear();
    mockFetchProfile.mockResolvedValue({ ...noTerms, id: OTHER, displayName: 'Ion' });
    await emit('SIGNED_IN', session(OTHER, 'access-9'));
    await waitForState('needsTerms|Ion|access-9');
    expect(acceptTerms).not.toHaveBeenCalled();
  });

  it('a session ended elsewhere (SIGNED_OUT event) also clears the stored consent', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    (acceptTerms as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await storeConsent(TV);
    mockFetchProfile.mockResolvedValue(noTerms);
    await renderAuth();
    await waitForState('signedOut|-|-');
    await emit('SIGNED_IN', session());
    await waitForState('needsTerms|Ana|access-1');
    await emit('SIGNED_OUT', null);
    await waitForState('signedOut|-|-');
    await waitFor(async () => expect(await getStoredConsent()).toBeNull());
  });

  it('a consent ticked on Welcome survives while signed out (not cleared by the signed-out start)', async () => {
    await renderAuth();
    await waitForState('signedOut|-|-');
    await storeConsent(TV);
    await emit('SIGNED_OUT', null);
    await expect(getStoredConsent()).resolves.toBe(TV);
  });

  it('refreshProfile after the gate moves needsTerms → ready', async () => {
    auth.getSession.mockResolvedValue({ data: { session: session() }, error: null });
    mockFetchProfile.mockResolvedValue(noTerms);
    await renderAuth();
    await waitForState('needsTerms|Ana|access-1');
    mockFetchProfile.mockResolvedValue({ ...noTerms, termsVersion: TV });
    await act(() => latest.refreshProfile());
    expect(state()).toBe('ready|Ana|access-1');
  });

  it('an offline profile load never shows the gate', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await storeConsent(TV);
    auth.getSession.mockResolvedValue({ data: { session: session() }, error: null });
    mockFetchProfile.mockRejectedValue(new Error('offline'));
    await renderAuth();
    await waitForState('ready|-|access-1');
    expect(acceptTerms).not.toHaveBeenCalled();
  });
});

describe('suspension', () => {
  it('a session with a suspended profile → suspended', async () => {
    auth.getSession.mockResolvedValue({ data: { session: session() }, error: null });
    mockFetchProfile.mockResolvedValue({ id: USER, displayName: null, learningMode: null, creditBalance: 5, termsVersion: TV, suspendedReason: 'Motiv', accessUntil: null });
    await renderAuth();
    await waitForState('suspended|-|access-1');
    expect(logAppOpen).not.toHaveBeenCalled();
  });

  it('registers refreshProfile for the API layer (a 403 suspended moves the student to suspended)', async () => {
    auth.getSession.mockResolvedValue({ data: { session: session() }, error: null });
    const view = await renderAuth();
    await waitForState('ready|Ana|access-1');
    mockFetchProfile.mockResolvedValue({ id: USER, displayName: 'Ana', learningMode: 'guided', creditBalance: 5, termsVersion: TV, suspendedReason: 'Motiv', accessUntil: null });
    await act(() => refreshRegisteredProfile());
    await waitForState('suspended|Ana|access-1');
    await view.unmount();
    mockFetchProfile.mockClear();
    await refreshRegisteredProfile();
    expect(mockFetchProfile).not.toHaveBeenCalled();
  });
});

describe('app opened event', () => {
  let onChange: (s: string) => void;
  beforeEach(() => {
    onChange = () => {};
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, cb) => {
      onChange = cb as (s: string) => void;
      return { remove: jest.fn() } as never;
    });
    auth.getSession.mockResolvedValue({ data: { session: session() }, error: null });
  });

  it('is logged once when the status becomes ready, and not again on two foregrounds the same day', async () => {
    await renderAuth();
    await waitForState('ready|Ana|access-1');
    await waitFor(() => expect(logAppOpen).toHaveBeenCalledTimes(1));
    await act(async () => onChange('background'));
    await act(async () => onChange('active'));
    await act(async () => onChange('background'));
    await act(async () => onChange('active'));
    expect(logAppOpen).toHaveBeenCalledTimes(1);
  });

  it('is logged again on a foreground the next day', async () => {
    await renderAuth();
    await waitFor(() => expect(logAppOpen).toHaveBeenCalledTimes(1));
    (localDay as jest.Mock).mockReturnValue('2026-11-07');
    await act(async () => onChange('active'));
    await waitFor(() => expect(logAppOpen).toHaveBeenCalledTimes(2));
  });

  it('retries on the next foreground when the log failed', async () => {
    (logAppOpen as jest.Mock).mockResolvedValueOnce(false);
    await renderAuth();
    await waitFor(() => expect(logAppOpen).toHaveBeenCalledTimes(1));
    await act(async () => onChange('active'));
    await waitFor(() => expect(logAppOpen).toHaveBeenCalledTimes(2));
    await act(async () => onChange('active'));
    expect(logAppOpen).toHaveBeenCalledTimes(2);
  });

  it('is not logged while signed out or before the profile is complete', async () => {
    mockFetchProfile.mockResolvedValue({ id: USER, displayName: null, learningMode: null, creditBalance: 5, termsVersion: TV, suspendedReason: null, accessUntil: null });
    await renderAuth();
    await waitForState('needsName|-|access-1');
    await act(async () => onChange('active'));
    expect(logAppOpen).not.toHaveBeenCalled();
  });
});

describe('suspension changes while the app is open', () => {
  let onChange: (s: string) => void;
  beforeEach(() => {
    onChange = () => {};
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, cb) => {
      onChange = cb as (s: string) => void;
      return { remove: jest.fn() } as never;
    });
    auth.getSession.mockResolvedValue({ data: { session: session() }, error: null });
  });

  it('back in the foreground, a student suspended meanwhile moves to suspended', async () => {
    await renderAuth();
    await waitForState('ready|Ana|access-1');
    mockFetchProfile.mockResolvedValue({ id: USER, displayName: 'Ana', learningMode: 'guided', creditBalance: 5, termsVersion: TV, suspendedReason: 'Motiv', accessUntil: null });
    await act(async () => onChange('active'));
    await waitForState('suspended|Ana|access-1');
  });

  it('back in the foreground, a reactivated student moves back to ready', async () => {
    mockFetchProfile.mockResolvedValue({ id: USER, displayName: 'Ana', learningMode: 'guided', creditBalance: 5, termsVersion: TV, suspendedReason: 'Motiv', accessUntil: null });
    await renderAuth();
    await waitForState('suspended|Ana|access-1');
    mockFetchProfile.mockResolvedValue({ id: USER, displayName: 'Ana', learningMode: 'guided', creditBalance: 5, termsVersion: TV, suspendedReason: null, accessUntil: null });
    await act(async () => onChange('active'));
    await waitForState('ready|Ana|access-1');
  });

  it('back in the foreground, a student on the terms gate who was suspended meanwhile moves to suspended', async () => {
    mockFetchProfile.mockResolvedValue({ id: USER, displayName: 'Ana', learningMode: 'guided', creditBalance: 5, termsVersion: null, suspendedReason: null, accessUntil: null });
    await renderAuth();
    await waitForState('needsTerms|Ana|access-1');
    mockFetchProfile.mockResolvedValue({ id: USER, displayName: 'Ana', learningMode: 'guided', creditBalance: 5, termsVersion: null, suspendedReason: 'Motiv', accessUntil: null });
    await act(async () => onChange('active'));
    await waitForState('suspended|Ana|access-1');
  });

  it('back in the foreground, a ready student whose accepted terms no longer match goes to the gate', async () => {
    await renderAuth();
    await waitForState('ready|Ana|access-1');
    mockFetchProfile.mockResolvedValue({ id: USER, displayName: 'Ana', learningMode: 'guided', creditBalance: 5, termsVersion: '2020-01-01', suspendedReason: null, accessUntil: null });
    await act(async () => onChange('active'));
    await waitForState('needsTerms|Ana|access-1');
  });

  it('back in the foreground, an unchanged gate profile stays on the gate', async () => {
    mockFetchProfile.mockResolvedValue({ id: USER, displayName: 'Ana', learningMode: 'guided', creditBalance: 5, termsVersion: null, suspendedReason: null, accessUntil: null });
    await renderAuth();
    await waitForState('needsTerms|Ana|access-1');
    await act(async () => onChange('active'));
    expect(state()).toBe('needsTerms|Ana|access-1');
  });

  it('a failed check keeps the current state', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await renderAuth();
    await waitForState('ready|Ana|access-1');
    mockFetchProfile.mockRejectedValue(new Error('offline'));
    await act(async () => onChange('active'));
    expect(state()).toBe('ready|Ana|access-1');
  });
});
