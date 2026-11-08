// Manual Jest mock (`jest.mock('…/access/AccessProvider')`): an in-memory plan and offer that re-render their
// readers, so a test sees the pill and the sheet follow `applyPurchase` / `applyOffer` the way the real provider does.
import { useSyncExternalStore, type ReactNode } from 'react';
import { accessStatus, hasFullAccess, type AccessOffer, type AccessPurchaseResponse } from '@prepio/shared';

type State = { accessUntil: string | null; offer: AccessOffer | null; freeLessonId: string | null; isAdmin: boolean; ready: boolean };

export const MOCK_OFFER: AccessOffer = { priceBani: 15000, bonusCredits: 100, durationMonths: 3 };
const initial = (): State => ({ accessUntil: null, offer: MOCK_OFFER, freeLessonId: 'free', isAdmin: false, ready: true });

let state: State = initial();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Test helper: start from a trial with the default offer, then apply `patch`. */
export function mockResetAccess(patch: Partial<State> = {}) {
  state = { ...initial(), ...patch };
  emit();
}

export const applyPurchase = jest.fn((r: AccessPurchaseResponse) => {
  state = { ...state, accessUntil: r.accessUntil };
  emit();
});
export const applyOffer = jest.fn((offer: AccessOffer) => {
  state = { ...state, offer };
  emit();
});
export const refresh = jest.fn(async () => {});

export function useAccess() {
  const s = useSyncExternalStore(subscribe, () => state);
  const status = accessStatus(s.accessUntil, new Date());
  const full = hasFullAccess(status);
  return {
    status,
    offer: s.offer,
    refresh,
    applyPurchase,
    applyOffer,
    canOpen: (id: string) => s.isAdmin || full || id === s.freeLessonId,
    freeLessonId: s.freeLessonId,
    isAdmin: s.isAdmin,
    ready: s.ready,
  };
}

export function AccessProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
