import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { fetchProfile, type Profile } from '../lib/profile';
import { getSupabase, isAuthRejection, signOut as signOutSession, withTimeout } from '../lib/supabase';
import { signOutGoogle } from './google';
import { localDay, logAppOpen } from '../lib/activity';
import { registerProfileRefresh } from '../lib/profileRefresh';
import { setSentryUser } from '../lib/sentry';

export type AuthStatus = 'loading' | 'signedOut' | 'suspended' | 'needsName' | 'needsMode' | 'ready';

export type AuthContextValue = {
  status: AuthStatus;
  /**
   * The current session. Can be null while `ready` when the app started offline with an expired token: the
   * session is still stored and comes back with the next successful refresh (TOKEN_REFRESHED).
   */
  session: Session | null;
  profile: Profile | null;
  /**
   * Re-reads the profile (e.g. after the name is saved) and updates `status`. Never throws: resolves with the
   * profile the context now holds (the previous one when the reload failed), so callers can check it.
   */
  refreshProfile(): Promise<Profile | null>;
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
 * A suspended account comes first: it only sees the suspended screen, whatever else is missing.
 */
export function statusFor(profile: Profile | null, loadFailed: boolean): AuthStatus {
  if (profile?.suspendedReason) return 'suspended';
  if (!profile?.displayName) return loadFailed ? 'ready' : 'needsName';
  return profile.learningMode ? 'ready' : 'needsMode';
}

/** `ready` without a profile or session: something failed to load and is worth retrying. */
const degraded = (s: AuthState) => s.status === 'ready' && (!s.session || !s.profile);
/** Signed in with the profile settled: an auth event for the same student needs no reload. */
const SETTLED: AuthStatus[] = ['ready', 'suspended', 'needsName', 'needsMode'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', session: null, profile: null });
  const stateRef = useRef(state);
  stateRef.current = state;
  /** Bumped by every auth change; an async load whose generation is stale drops its result. */
  const generation = useRef(0);
  const userId = useRef<string | null>(null);
  /** `<user>|<local day>` of the last app-opened event sent by this run: at most one per student per day. */
  const lastOpen = useRef<string | null>(null);

  const apply = useCallback((next: AuthState) => {
    generation.current += 1;
    userId.current = next.session?.user.id ?? null;
    // Error reports carry the Supabase user id only (no email or name).
    setSentryUser(userId.current);
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
          // A newer auth event (e.g. a fresh sign-in) owns the state and the stored session now: leave both alone.
          if (start !== generation.current) return;
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

  /** Records the app-opened event for a signed-in student who is in, once per local day (the server dedups too). */
  const noteAppOpen = useCallback(() => {
    const { status, session } = stateRef.current;
    if (status !== 'ready' || !session) return;
    const key = `${session.user.id}|${localDay()}`;
    if (lastOpen.current === key) return;
    lastOpen.current = key;
    void logAppOpen().then((ok) => {
      // Not recorded (offline, outage): the next foreground tries again.
      if (!ok && lastOpen.current === key) lastOpen.current = null;
    });
  }, []);

  /**
   * Back in the foreground: re-reads the profile of a loaded student, so a suspension (or a reactivation) made by
   * an admin while the app was open takes effect. Only a changed suspension moves the status; a failed read
   * changes nothing.
   */
  const recheckSuspension = useCallback(async () => {
    const { status, session, profile } = stateRef.current;
    if ((status !== 'ready' && status !== 'suspended') || !session || !profile) return;
    const start = generation.current;
    let fresh: Profile | null;
    try {
      fresh = await withTimeout(fetchProfile(session.user.id));
    } catch (e) {
      console.warn('[auth] suspension check failed:', e);
      return;
    }
    if (start !== generation.current || !fresh || stateRef.current.session?.user.id !== fresh.id) return;
    const cur = stateRef.current.profile;
    if ((fresh.suspendedReason ?? null) === (cur?.suspendedReason ?? null) && (fresh.accessUntil ?? null) === (cur?.accessUntil ?? null)) return;
    const next = { ...stateRef.current, status: statusFor(fresh, false), profile: fresh };
    stateRef.current = next;
    setState(next);
  }, []);

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
      if (SETTLED.includes(cur.status) && cur.profile && session.user.id === userId.current) {
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
    // back in the foreground, retry whatever failed to load. On every platform a return to the foreground
    // re-checks the suspension and counts as an app open (react-native-web maps it to the page visibility).
    const native = Platform.OS !== 'web';
    if (native && AppState.currentState === 'active') auth.startAutoRefresh();
    const appState = AppState.addEventListener('change', (next) => {
      if (next !== 'active') {
        if (native) auth.stopAutoRefresh();
        return;
      }
      if (native) {
        auth.startAutoRefresh();
        if (degraded(stateRef.current)) void restore().catch((e) => console.warn('[auth] retry failed:', e));
      }
      void recheckSuspension();
      noteAppOpen();
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
      appState.remove();
    };
  }, [restore, settle, setSignedOut, recheckSuspension, noteAppOpen]);

  // The app counts as opened once the student is in (the foreground listener covers later returns).
  useEffect(() => {
    if (state.status === 'ready' && state.session) noteAppOpen();
  }, [state.status, state.session, noteAppOpen]);

  const refreshProfile = useCallback(async () => {
    const { session } = stateRef.current;
    // Offline start (ready without a session): re-read the stored session instead of treating it as signed out.
    if (session) await settle(session);
    else if (stateRef.current.status === 'ready') await restore();
    return stateRef.current.profile;
  }, [restore, settle]);

  // Lets the API layer re-read the profile when the server answers 403 `suspended` (see lib/profileRefresh).
  useEffect(() => registerProfileRefresh(refreshProfile), [refreshProfile]);

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
