// Manual Jest mock (jest.mock of the streak/StreakProvider module): screens under test get a `markActive` spy.
import type { ReactNode } from 'react';

export const markActive = jest.fn();
export const refresh = jest.fn(async () => {});
export const onFirstOfDay = jest.fn(() => () => {});

export const useMarkActive = () => markActive;
export const useStreak = () => ({ summary: null, refresh, onFirstOfDay });

export function StreakProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
