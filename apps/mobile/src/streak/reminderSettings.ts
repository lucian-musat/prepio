import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_REMINDER, type ReminderTime } from '@prepio/shared';

export type ReminderSettings = {
  enabled: boolean;
  time: ReminderTime;
  /** The permission prompt was shown at least once (after the first solved exercise); it is never auto-shown again. */
  asked: boolean;
};

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

const KEY = 'prepio.reminder.v1';

const defaults = (): ReminderSettings => ({ enabled: true, time: { ...DEFAULT_REMINDER }, asked: false });

const isTime = (t: unknown): t is ReminderTime => {
  const v = t as ReminderTime | null;
  return (
    !!v &&
    Number.isInteger(v.hour) &&
    Number.isInteger(v.minute) &&
    v.hour >= 0 &&
    v.hour <= 23 &&
    v.minute >= 0 &&
    v.minute <= 59
  );
};

/** Never throws: a missing, unreadable or corrupt value gives the defaults. */
export async function loadReminderSettings(): Promise<ReminderSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return defaults();
    const v = JSON.parse(raw) as Partial<ReminderSettings> | null;
    if (!v || typeof v !== 'object') return defaults();
    return {
      enabled: typeof v.enabled === 'boolean' ? v.enabled : true,
      time: isTime(v.time) ? { hour: v.time.hour, minute: v.time.minute } : { ...DEFAULT_REMINDER },
      asked: v.asked === true,
    };
  } catch {
    return defaults();
  }
}

export async function saveReminderSettings(s: ReminderSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
  } catch (e) {
    console.warn('[reminders] could not save settings:', e);
  }
}
