// Manual Jest mock (jest.mock of the streak/StreakProvider module): screens under test get a `markActive` spy.
import type { ReactNode } from 'react';
import type { StreakSummary } from '@prepio/shared';

export const markActive = jest.fn();
export const refresh = jest.fn(async () => {});
export const onFirstOfDay = jest.fn(() => () => {});

export const useMarkActive = () => markActive;
export const streakState: { summary: StreakSummary | null } = { summary: null };
export const useStreak = () => ({ summary: streakState.summary, refresh, onFirstOfDay });

export function StreakProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export const setEnabled = jest.fn(async () => {});
export const setTime = jest.fn(async () => {});
export const reminderState: {
  settings: { enabled: boolean; time: { hour: number; minute: number }; asked: boolean };
  status: 'granted' | 'denied' | 'undetermined' | 'unsupported';
} = { settings: { enabled: true, time: { hour: 19, minute: 0 }, asked: false }, status: 'undetermined' };
export const useReminders = () => ({ ...reminderState, setEnabled, setTime });
