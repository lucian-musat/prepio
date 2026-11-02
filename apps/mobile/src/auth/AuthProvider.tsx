import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { fetchProfile, type Profile } from '../lib/profile';
import { getSupabase, isAuthRejection, signOut as signOutSession, withTimeout } from '../lib/supabase';
import { signOutGoogle } from './google';

export type AuthStatus = 'loading' | 'signedOut' | 'needsName' | 'ready';

export type AuthContextValue = {
  status: AuthStatus;
  /**
   * The current session. Can be null while `ready` when the app started offline with an expired token: the
   * session is still stored and comes back with the next successful refresh (TOKEN_REFRESHED).
   */
  session: Session | null;
  profile: Profile | null;
  /** Re-reads the profile (e.g. after the name is saved) and updates `status`. */
  refreshProfile(): Promise<void>;
  signOut(): Promise<void>;
};

type AuthState = Pick<AuthContextValue, 'status' | 'session' | 'profile'>;

const SIGNED_OUT: AuthState = { status: 'signedOut', session: null, profile: null };
/** Signed in as far as we know, but the stored session can't be refreshed right now (offline / auth outage). */
const OFFLINE: AuthState = { status: 'ready', session: null, profile: null };

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * A profile that could not be loaded (offline, outage, timeout) lets the student in rather than asking a
 * returning student for their name again; it is retried on the next foreground / auth event.
 */
function statusFor(profile: Profile | null, loadFailed: boolean): AuthStatus {
  if (profile?.displayName) return 'ready';
  return loadFailed ? 'ready' : 'needsName';
}

/** `ready` without a profile or session: something failed to load and is worth retrying. */
const degraded = (s: AuthState) => s.status === 'ready' && (!s.session || !s.profile);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', session: null, profile: null });
  const stateRef = useRef(state);
  stateRef.current = state;
  /** Bumped by every auth change; an async load whose generation is stale drops its result. */
  const generation = useRef(0);
  const userId = useRef<string | null>(null);

  const apply = useCallback((next: AuthState) => {
    generation.current += 1;
    userId.current = next.session?.user.id ?? null;
    stateRef.current = next;
    setState(next);
  }, []);
  const setSignedOut = useCallback(() => apply(SIGNED_OUT), [apply]);

  /** Loads the profile for `session` and settles the status, unless a newer auth change arrived meanwhile. */
  const settle = useCallback(
    async (session: Session | null) => {
      if (!session) return setSignedOut();
      const mine = ++generation.current;
      userId.current = session.user.id;
      let profile: Profile | null = null;
      let failed = false;
      try {
        profile = await withTimeout(fetchProfile(session.user.id));
      } catch (e) {
        console.warn('[auth] profile could not be loaded:', e);
        failed = true;
      }
      if (mine !== generation.current) return;
      const prev = stateRef.current;
      const kept = failed && prev.profile?.id === session.user.id ? prev.profile : profile;
      const next = { status: statusFor(kept, failed && !kept), session, profile: kept };
      stateRef.current = next;
      setState(next);
    },
    [setSignedOut],
  );

  /**
   * Reads the stored session and checks it with the server. Only a real rejection (user deleted, session revoked,
   * refresh token invalid) signs out; network failures and timeouts keep the stored session.
   */
  const restore = useCallback(async () => {
    const auth = getSupabase().auth;
    const start = generation.current;
    let session: Session | null;
    try {
      const { data, error } = await withTimeout(auth.getSession());
      session = data.session;
      if (!session && error && !isAuthRejection(error)) {
        // Expired token + refresh failed for a network reason: auth-js keeps the session in storage.
        if (start === generation.current) apply(OFFLINE);
        return;
      }
    } catch (e) {
      console.warn('[auth] stored session could not be read:', e);
      if (start === generation.current) apply(OFFLINE);
      return;
    }
    if (session) {
      try {
        const { data, error } = await withTimeout(auth.getUser());
        if (error ? isAuthRejection(error) : !data.user) {
          await signOutSession();
          setSignedOut();
          return;
        }
      } catch (e) {
        console.warn('[auth] session could not be verified, keeping it:', e);
      }
    }
    if (start !== generation.current) return; // an auth event already settled the state
    await settle(session);
  }, [apply, settle, setSignedOut]);

  useEffect(() => {
    const auth = getSupabase().auth;
    let mounted = true;

    restore().catch((e) => {
      console.warn('[auth] could not restore the session:', e);
      // A later TOKEN_REFRESHED / SIGNED_IN still moves us into the normal settle path (see the listener).
      if (mounted && stateRef.current.status === 'loading') setSignedOut();
    });

    const { data: listener } = auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return; // handled by restore()
      if (event === 'SIGNED_OUT' || !session) return setSignedOut();
      const cur = stateRef.current;
      const settled = cur.status === 'ready' || cur.status === 'needsName';
      if (settled && cur.profile && session.user.id === userId.current) {
        // Same student, everything loaded: swap the session (new token) without reloading or changing screen.
        const next = { ...cur, session };
        stateRef.current = next;
        setState(next);
        return;
      }
      // New student, recovery from offline/signedOut, or a profile still missing. Don't call Supabase from
      // inside the callback (auth-js holds a lock there); settle on the next tick.
      setTimeout(() => {
        if (mounted) void settle(session);
      }, 0);
    });

    // On native, refresh the token only while the app is in the foreground (web handles visibility itself);
    // back in the foreground, retry whatever failed to load.
    let appState: { remove(): void } | undefined;
    if (Platform.OS !== 'web') {
      if (AppState.currentState === 'active') auth.startAutoRefresh();
      appState = AppState.addEventListener('change', (next) => {
        if (next !== 'active') return void auth.stopAutoRefresh();
        auth.startAutoRefresh();
        if (degraded(stateRef.current)) void restore().catch((e) => console.warn('[auth] retry failed:', e));
      });
    }

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
      appState?.remove();
    };
  }, [restore, settle, setSignedOut]);

  const refreshProfile = useCallback(async () => {
    const { session } = stateRef.current;
    // Offline start (ready without a session): re-read the stored session instead of treating it as signed out.
    if (session) await settle(session);
    else if (stateRef.current.status === 'ready') await restore();
  }, [restore, settle]);

  const signOut = useCallback(async () => {
    // Forget the Google account too (native), so the next sign-in shows the account picker. Best-effort.
    await signOutGoogle().catch((e) => console.warn('[auth] Google sign-out failed:', e));
    await signOutSession();
    setSignedOut();
  }, [setSignedOut]);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, refreshProfile, signOut }),
    [state, refreshProfile, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
