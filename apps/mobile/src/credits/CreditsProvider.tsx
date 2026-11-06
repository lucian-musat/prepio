import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { fetchCreditBalance } from '../lib/credits';

export type CreditsChange = { delta: number; id: number };

type CreditsContextValue = {
  balance: number | null;
  /** Sets the balance (e.g. from an API response) and records the difference in `change`. */
  setBalance(n: number): void;
  /** Re-reads `profiles.credit_balance`; never throws. */
  refresh(): Promise<void>;
  /** The latest balance movement; `id` changes each time so the UI can animate it once. */
  change: CreditsChange | null;
};

const CreditsContext = createContext<CreditsContextValue | null>(null);

export function CreditsProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const userId = profile?.id ?? null;
  const profileBalance = profile?.creditBalance ?? null;
  const [balance, setBalanceState] = useState<number | null>(profileBalance);
  const [change, setChange] = useState<CreditsChange | null>(null);
  const balanceRef = useRef(balance);
  const changeId = useRef(0);
  const mounted = useRef(true);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const apply = useCallback((next: number) => {
    const old = balanceRef.current;
    balanceRef.current = next;
    setBalanceState(next);
    if (old !== null && old !== next) setChange({ delta: next - old, id: ++changeId.current });
  }, []);

  // A profile reload (or another student) resets the balance without animating a change.
  useEffect(() => {
    balanceRef.current = profileBalance;
    setBalanceState(profileBalance);
  }, [userId, profileBalance]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const fresh = await fetchCreditBalance(userId);
      // Drop a result that arrives after unmount or after another student signed in.
      if (!mounted.current || userIdRef.current !== userId) return;
      if (fresh !== null) apply(fresh);
    } catch (e) {
      console.warn('[credits] balance could not be refreshed:', e);
    }
  }, [userId, apply]);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refreshRef.current();
    });
    return () => sub.remove();
  }, []);

  const value = useMemo(() => ({ balance, setBalance: apply, refresh, change }), [balance, apply, refresh, change]);
  return <CreditsContext.Provider value={value}>{children}</CreditsContext.Provider>;
}

export function useCredits(): CreditsContextValue {
  const v = useContext(CreditsContext);
  if (!v) throw new Error('useCredits must be used inside CreditsProvider');
  return v;
}
