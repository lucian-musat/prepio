// Web build: local notifications are a phone feature, so everything here is a no-op. This file must not import
// expo-notifications (Metro picks reminders.native.ts on Android, this file on web).
import type { StreakSummary } from '@prepio/shared';
import type { PermissionStatus, ReminderSettings } from './reminderSettings';

export function remindersSupported(): boolean {
  return false;
}

export async function permission(): Promise<PermissionStatus> {
  return 'undetermined';
}

export async function requestPermission(): Promise<boolean> {
  return false;
}

export async function syncReminders(_s: StreakSummary | null, _settings: ReminderSettings, _now?: Date): Promise<void> {}

export function onReminderTap(_cb: () => void): () => void {
  return () => {};
}

/** Cancels every scheduled reminder (sign-out, user switch). */
export async function cancelReminders(): Promise<void> {}

export async function canAskAgain(): Promise<boolean> {
  return false;
}
