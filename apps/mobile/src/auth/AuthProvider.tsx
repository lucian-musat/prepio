import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { fetchProfile, type Profile } from '../lib/profile';
import { getSupabase, signOut as signOutSession } from '../lib/supabase';

export type AuthStatus = 'loading' | 'signedOut' | 'needsName' | 'ready';

export type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  profile: Profile | null;
  /** Re-reads the profile (e.g. after the name is saved) and updates `status`. */
  refreshProfile(): Promise<void>;
  signOut(): Promise<void>;
};

type AuthState = Pick<AuthContextValue, 'status' | 'session' | 'profile'>;

const SIGNED_OUT: AuthState = { status: 'signedOut', session: null, profile: null };

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * True when Supabase says the stored token is no good (user deleted, session revoked) — as opposed to a network
 * or server failure, where the stored session is kept. auth-js reports a revoked session as
 * AuthSessionMissingError (status 400).
 */
function sessionRejected(error: { name?: string; status?: number }): boolean {
  return error.name === 'AuthSessionMissingError' || error.status === 401 || error.status === 403;
}

/**
 * A profile that could not be loaded (offline, outage) lets the student in rather than asking a returning
 * student for their name again; the name screen shows up on the next successful load if it is really missing.
 */
function statusFor(profile: Profile | null, loadFailed: boolean): AuthStatus {
  if (profile?.displayName) return 'ready';
  return loadFailed ? 'ready' : 'needsName';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', session: null, profile: null });
  /** Bumped by every auth change; an async load whose generation is stale drops its result. */
  const generation = useRef(0);
  const userId = useRef<string | null>(null);

  const setSignedOut = useCallback(() => {
    generation.current += 1;
    userId.current = null;
    setState(SIGNED_OUT);
  }, []);

  /** Loads the profile for `session` and settles the status, unless a newer auth change arrived meanwhile. */
  const settle = useCallback(
    async (session: Session | null) => {
      if (!session) return setSignedOut();
      const mine = ++generation.current;
      userId.current = session.user.id;
      let profile: Profile | null = null;
      let failed = false;
      try {
        profile = await fetchProfile(session.user.id);
      } catch (e) {
        console.warn('[auth] profile could not be loaded:', e);
        failed = true;
      }
      if (mine !== generation.current) return;
      setState((prev) => {
        const kept = failed && prev.profile?.id === session.user.id ? prev.profile : profile;
        return { status: statusFor(kept, failed && !kept), session, profile: kept };
      });
    },
    [setSignedOut],
  );

  useEffect(() => {
    const auth = getSupabase().auth;
    let mounted = true;

    const initial = async () => {
      const start = generation.current;
      const { data } = await auth.getSession();
      let session = data.session;
      if (session) {
        // The stored session may belong to a user deleted (or signed out) elsewhere: ask the server.
        const { data: userData, error } = await auth.getUser();
        if (error ? sessionRejected(error) : !userData.user) {
          await signOutSession();
          if (mounted) setSignedOut();
          return;
        }
      }
      if (!mounted || start !== generation.current) return; // an auth event already settled the state
      await settle(session);
    };
    initial().catch((e) => {
      console.warn('[auth] could not restore the session:', e);
      if (mounted && generation.current === 0) setSignedOut();
    });

    const { data: listener } = auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return; // handled by initial()
      if (event === 'SIGNED_OUT' || !session) return setSignedOut();
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED' || session.user.id === userId.current) {
        // Same student: swap the session (new token) without reloading the profile or leaving the current screen.
        setState((prev) => (prev.status === 'loading' || prev.status === 'signedOut' ? prev : { ...prev, session }));
        return;
      }
      // Don't call Supabase from inside the callback (auth-js holds a lock there); settle on the next tick.
      setTimeout(() => {
        if (mounted) void settle(session);
      }, 0);
    });

    // On native, refresh the token only while the app is in the foreground (web handles visibility itself).
    let appState: { remove(): void } | undefined;
    if (Platform.OS !== 'web') {
      if (AppState.currentState === 'active') auth.startAutoRefresh();
      appState = AppState.addEventListener('change', (next) => {
        if (next === 'active') auth.startAutoRefresh();
        else auth.stopAutoRefresh();
      });
    }

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
      appState?.remove();
    };
  }, [settle, setSignedOut]);

  const refreshProfile = useCallback(async () => {
    await settle(state.session);
  }, [settle, state.session]);

  const signOut = useCallback(async () => {
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
