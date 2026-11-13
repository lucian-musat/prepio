import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { bucharestDay, streakToast, type StreakSummary } from '@prepio/shared';
import { useAuth } from '../auth/AuthProvider';
import { fetchStreak, markActiveToday } from '../lib/streak';
import StreakToast from './StreakToast';

const TOAST_MS = 3000;

type StreakContextValue = {
  summary: StreakSummary | null;
  /** Re-reads the streak; never throws. */
  refresh(): Promise<void>;
  /** Calls `cb` when a mark turns today into an active day (the first exercise of the day); returns the unsubscribe. */
  onFirstOfDay(cb: () => void): () => void;
};

const StreakContext = createContext<StreakContextValue | null>(null);
const MarkContext = createContext<() => void>(() => {});

/** The last server-confirmed summary and the Bucharest day it was obtained on. */
type Confirmed = { summary: StreakSummary; day: string };

export function StreakProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const userId = profile?.id ?? null;
  const [summary, setSummary] = useState<StreakSummary | null>(null);
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const confirmed = useRef<Confirmed | null>(null);
  const marking = useRef(false);
  /** Bumped by every applied result, so a slower older read never overwrites a newer one. */
  const version = useRef(0);
  const toastId = useRef(0);
  const listeners = useRef(new Set<() => void>());
  const mounted = useRef(true);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Another student (or sign-out) starts clean.
  useEffect(() => {
    confirmed.current = null;
    marking.current = false;
    version.current++;
    setSummary(null);
    setToast(null);
  }, [userId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);

  const apply = useCallback((next: StreakSummary) => {
    version.current++;
    confirmed.current = { summary: next, day: bucharestDay(new Date()) };
    setSummary(next);
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const started = version.current;
    const fresh = await fetchStreak();
    // Drop a result that arrives after unmount, after another student signed in, or after a newer result.
    if (!mounted.current || userIdRef.current !== userId || version.current !== started) return;
    if (fresh) apply(fresh);
  }, [userId, apply]);

  const mark = useCallback(async () => {
    if (!userId || marking.current) return;
    const before = confirmed.current;
    // One mark per Bucharest day: skip only a done summary obtained today.
    if (before && before.day === bucharestDay(new Date()) && before.summary.todayDone) return;
    marking.current = true;
    const stale = () => !mounted.current || userIdRef.current !== userId;
    try {
      // Read first: another device may already have recorded today, and then this is not the first of the day.
      const fresh = await fetchStreak();
      if (stale()) return;
      if (fresh) {
        apply(fresh);
        if (fresh.todayDone) return;
      }
      const marked = await markActiveToday();
      if (stale() || !marked) return;
      apply(marked);
      // Without a successful read we cannot know it was the first exercise of the day: no toast.
      if (fresh && marked.todayDone) {
        setToast({ text: streakToast(marked.current), id: ++toastId.current });
        listeners.current.forEach((cb) => {
          try {
            cb();
          } catch (e) {
            console.warn('[streak] onFirstOfDay listener failed:', e);
          }
        });
      }
    } finally {
      if (!stale()) marking.current = false;
    }
  }, [userId, apply]);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    void refreshRef.current();
  }, [userId]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refreshRef.current();
    });
    return () => sub.remove();
  }, []);

  const onFirstOfDay = useCallback((cb: () => void) => {
    listeners.current.add(cb);
    return () => {
      listeners.current.delete(cb);
    };
  }, []);

  const markRef = useRef(mark);
  markRef.current = mark;
  const markActive = useCallback(() => void markRef.current(), []);

  const value = useMemo(() => ({ summary, refresh, onFirstOfDay }), [summary, refresh, onFirstOfDay]);
  return (
    <StreakContext.Provider value={value}>
      <MarkContext.Provider value={markActive}>
        {children}
        {toast ? <StreakToast key={toast.id} text={toast.text} /> : null}
      </MarkContext.Provider>
    </StreakContext.Provider>
  );
}

export function useStreak(): StreakContextValue {
  const v = useContext(StreakContext);
  if (!v) throw new Error('useStreak must be used inside StreakProvider');
  return v;
}

/** Fire-and-forget: records today as an active day. A no-op outside the provider (the admin lesson preview). */
export function useMarkActive(): () => void {
  return useContext(MarkContext);
}
