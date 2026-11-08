import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { accessStatus, hasFullAccess, type AccessOffer, type AccessPurchaseResponse, type AccessStatus } from '@prepio/shared';
import { useAuth } from '../auth/AuthProvider';
import { fetchAccessOffer, fetchAccessUntil, fetchFreeLessonId, fetchIsAdmin } from '../lib/access';
import { registerAccessRefresh } from '../lib/profileRefresh';

type AccessContextValue = {
  status: AccessStatus;
  offer: AccessOffer | null;
  /** Re-reads access_until, the offer and the free lesson; never throws. */
  refresh(): Promise<void>;
  /** Applies a successful purchase right away, before the next re-read. */
  applyPurchase(r: AccessPurchaseResponse): void;
  /** Replaces the shown offer (the server's current one after a 409 `offer_changed`). */
  applyOffer(offer: AccessOffer): void;
  /** Full access opens every lesson; a trial (or expired) account opens only the free one. */
  canOpen(lessonId: string): boolean;
  /** First lesson in Home order (the same one the server leaves open); null when nothing is published. */
  freeLessonId: string | null;
  /** Admins have every lesson open, like on the server. */
  isAdmin: boolean;
  /** False until the first access read has settled (success or failure): trial-only locks are not final before. */
  ready: boolean;
};

const AccessContext = createContext<AccessContextValue | null>(null);

export function AccessProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const userId = profile?.id ?? null;
  const profileUntil = profile?.accessUntil ?? null;
  const [accessUntil, setAccessUntil] = useState<string | null>(profileUntil);
  const [offer, setOffer] = useState<AccessOffer | null>(null);
  const [freeLessonId, setFreeLessonId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady] = useState(false);
  // Bumped by every refresh start and by applyPurchase: a refresh that was overtaken must not overwrite newer state.
  const generation = useRef(0);
  // Re-evaluates the plan against the clock whenever the state is re-read (focus, foreground, purchase).
  const [now, setNow] = useState(() => new Date());
  const mounted = useRef(true);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // A profile reload (or another student) replaces the local value.
  useEffect(() => {
    setAccessUntil(profileUntil);
    setNow(new Date());
  }, [userId, profileUntil]);

  const refresh = useCallback(async () => {
    const id = userIdRef.current;
    if (!id) {
      setReady(true); // nothing to read (no profile): do not hold the UI back
      return;
    }
    const gen = ++generation.current;
    // Each read is independent: one failing (offline) keeps the previous value of the others.
    const [until, nextOffer, free, admin] = await Promise.allSettled([
      fetchAccessUntil(id),
      fetchAccessOffer(),
      fetchFreeLessonId(),
      fetchIsAdmin(),
    ]);
    // Drop results that arrive after unmount or after another student signed in.
    if (!mounted.current || userIdRef.current !== id || gen !== generation.current) return;
    if (until.status === 'fulfilled') setAccessUntil(until.value);
    else console.warn('[access] access_until could not be refreshed:', until.reason);
    if (nextOffer.status === 'fulfilled') setOffer(nextOffer.value);
    else console.warn('[access] offer could not be refreshed:', nextOffer.reason);
    if (free.status === 'fulfilled') setFreeLessonId(free.value);
    else console.warn('[access] free lesson could not be refreshed:', free.reason);
    if (admin.status === 'fulfilled') setIsAdmin(admin.value);
    else console.warn('[access] admin check could not be refreshed:', admin.reason);
    setNow(new Date());
    setReady(true);
  }, []);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    if (userId) void refreshRef.current();
  }, [userId]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refreshRef.current();
    });
    return () => sub.remove();
  }, []);
  // Lets the API layer trigger a re-read when the server answers 403 access_required.
  useEffect(() => registerAccessRefresh(() => refreshRef.current()), []);

  // Access running out while the app is open: re-evaluate at the end date (setTimeout caps at ~24.8 days).
  useEffect(() => {
    if (!accessUntil) return;
    const delay = new Date(accessUntil).getTime() - Date.now();
    if (delay <= 0 || delay > 2 ** 31 - 1) return;
    const t = setTimeout(() => setNow(new Date()), delay + 1000);
    return () => clearTimeout(t);
  }, [accessUntil]);

  const applyPurchase = useCallback((r: AccessPurchaseResponse) => {
    generation.current++; // an in-flight refresh started earlier is stale now
    setReady(true);
    setAccessUntil(r.accessUntil);
    setNow(new Date());
  }, []);

  const applyOffer = useCallback((next: AccessOffer) => setOffer(next), []);

  const status = useMemo(() => accessStatus(accessUntil, now), [accessUntil, now]);
  const full = hasFullAccess(status);
  const canOpen = useCallback((lessonId: string) => isAdmin || full || (freeLessonId !== null && lessonId === freeLessonId),
    [isAdmin, full, freeLessonId],);

  const value = useMemo(
    () => ({ status, offer, refresh, applyPurchase, applyOffer, canOpen, freeLessonId, isAdmin, ready }),
    [status, offer, refresh, applyPurchase, applyOffer, canOpen, freeLessonId, isAdmin, ready],
  );
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess(): AccessContextValue {
  const v = useContext(AccessContext);
  if (!v) throw new Error('useAccess must be used inside AccessProvider');
  return v;
}
