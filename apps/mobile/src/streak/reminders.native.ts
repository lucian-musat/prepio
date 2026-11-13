// Android build. `expo-notifications` is required inside try/catch: an APK built before the native module was added
// must keep working (reminders are then simply unsupported).
import { planReminders, type StreakSummary } from '@prepio/shared';
import { Platform } from 'react-native';
import type { PermissionStatus, ReminderSettings } from './reminderSettings';

type Notifications = typeof import('expo-notifications');

export const REMINDER_CHANNEL = 'daily-reminder';
const CHANNEL_NAME = 'Memento zilnic';

let N: Notifications | null = null;
try {
  N = require('expo-notifications') as Notifications;
  // A reminder that arrives while the app is open still shows as a banner.
  N.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
} catch {
  N = null;
}

export function remindersSupported(): boolean {
  return N !== null;
}

export async function permission(): Promise<PermissionStatus> {
  if (!N) return 'undetermined';
  try {
    const { status } = await N.getPermissionsAsync();
    return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
  } catch (e) {
    console.warn('[reminders] permission check failed:', e);
    return 'undetermined';
  }
}

/** Shows the system prompt (Android 13+; older versions grant at install). Resolves whether notifications are allowed. */
export async function requestPermission(): Promise<boolean> {
  if (!N) return false;
  try {
    // The channel must exist before the Android 13 prompt can be shown.
    await ensureChannel(N);
    const { status } = await N.requestPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    console.warn('[reminders] permission request failed:', e);
    return false;
  }
}

async function ensureChannel(n: Notifications): Promise<void> {
  if (Platform.OS !== 'android') return;
  await n.setNotificationChannelAsync(REMINDER_CHANNEL, { name: CHANNEL_NAME, importance: n.AndroidImportance.DEFAULT });
}

/**
 * Replaces the scheduled reminders: cancels everything (this app schedules no other notifications), then, when the
 * switch is on and the permission is granted, schedules the next days from `planReminders`. With an unknown streak
 * (`s` null) and the switch on, the existing reminders are left alone. Never throws.
 */
export async function syncReminders(s: StreakSummary | null, settings: ReminderSettings, now: Date = new Date()): Promise<void> {
  if (!N) return;
  try {
    const on = settings.enabled && (await permission()) === 'granted';
    if (on && !s) return;
    await N.cancelAllScheduledNotificationsAsync();
    if (!on || !s) return;
    await ensureChannel(N);
    for (const r of planReminders(now, settings.time, s)) {
      await N.scheduleNotificationAsync({
        content: { title: r.title, body: r.body },
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: REMINDER_CHANNEL },
      });
    }
  } catch (e) {
    console.warn('[reminders] could not sync:', e);
  }
}

/** Calls `cb` when the student taps a reminder, also when that tap launched the app. Returns the unsubscribe. */
export function onReminderTap(cb: () => void): () => void {
  const n = N;
  if (!n) return () => {};
  let sub: { remove(): void } | null = null;
  try {
    sub = n.addNotificationResponseReceivedListener(() => cb());
    void n
      .getLastNotificationResponseAsync()
      .then(async (res) => {
        if (!res) return;
        await n.clearLastNotificationResponseAsync();
        cb();
      })
      .catch(() => {});
  } catch (e) {
    console.warn('[reminders] tap listener failed:', e);
  }
  return () => sub?.remove();
}
