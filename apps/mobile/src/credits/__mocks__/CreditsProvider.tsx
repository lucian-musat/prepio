// Manual Jest mock (`jest.mock('…/credits/CreditsProvider')`): an in-memory balance that re-renders its readers,
// so a test sees the chip and the sheet follow `setBalance` the way the real provider does.
import { useSyncExternalStore, type ReactNode } from 'react';
import type { CreditsChange } from '../CreditsProvider';

type State = { balance: number | null; change: CreditsChange | null };

let state: State = { balance: 0, change: null };
let changeId = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Test helper: start from `balance` with no recorded change. */
export function mockResetCredits(balance: number | null) {
  state = { balance, change: null };
  emit();
}

/** Test helper: the balance the app currently holds. */
export function mockBalance(): number | null {
  return state.balance;
}

export const setBalance = jest.fn((next: number) => {
  const old = state.balance;
  state = { balance: next, change: old !== null && old !== next ? { delta: next - old, id: ++changeId } : state.change };
  emit();
});
export const refresh = jest.fn(async () => {});

export function useCredits() {
  const s = useSyncExternalStore(subscribe, () => state);
  return { balance: s.balance, change: s.change, setBalance, refresh };
}

export function CreditsProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
