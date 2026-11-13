import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { router } from 'expo-router';
import { DEFAULT_REMINDER, type ReminderTime, type StreakSummary } from '@prepio/shared';
import { loadReminderSettings, saveReminderSettings, type PermissionStatus, type ReminderSettings } from './reminderSettings';
import { cancelReminders, onReminderTap, permission, remindersSupported, requestPermission, syncReminders } from './reminders';

export type ReminderStatus = PermissionStatus | 'unsupported';

export type RemindersValue = {
  settings: ReminderSettings;
  /** The system permission; 'unsupported' on web or when this build has no notifications module. */
  status: ReminderStatus;
  /** Switches the reminders on or off; turning on asks for the permission when it was never decided. */
  setEnabled(on: boolean): Promise<void>;
  setTime(t: ReminderTime): Promise<void>;
};

const INITIAL: ReminderSettings = { enabled: true, time: { ...DEFAULT_REMINDER }, asked: false };

/**
 * Local evening reminders: keeps the settings and the system permission, and keeps the scheduled notifications in
 * step with the streak (on start, after every new summary, on return to the foreground, on settings change).
 * `onFirstOfDay` registers a listener fired when the first exercise of the day is recorded.
 */
export function useReminderController(
  userId: string | null,
  summary: StreakSummary | null,
  onFirstOfDay: (cb: () => void) => () => void,
): RemindersValue {
  const supported = remindersSupported();
  const [settings, setSettingsState] = useState<ReminderSettings>(INITIAL);
  const [status, setStatus] = useState<ReminderStatus>(supported ? 'undetermined' : 'unsupported');
  const [loaded, setLoaded] = useState(false);
  const settingsRef = useRef(settings);
  const statusRef = useRef(status);
  const summaryRef = useRef(summary);
  const mounted = useRef(true);
  /** Syncs run one after another: a cancel-then-schedule pair must never interleave with another. */
  const chain = useRef<Promise<void>>(Promise.resolve());
  settingsRef.current = settings;
  statusRef.current = status;
  summaryRef.current = summary;

  const enqueueSync = useCallback(() => {
    if (!supported) return;
    const s = summaryRef.current;
    const st = settingsRef.current;
    chain.current = chain.current.then(() => syncReminders(s, st)).catch(() => {});
  }, [supported]);

  const refreshStatus = useCallback(async () => {
    if (!supported) return;
    const next = await permission();
    if (mounted.current) {
      statusRef.current = next;
      setStatus(next);
    }
  }, [supported]);

  const update = useCallback(async (patch: Partial<ReminderSettings>) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettingsState(next);
    await saveReminderSettings(next);
  }, []);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    void (async () => {
      const [s] = await Promise.all([loadReminderSettings(), refreshStatus()]);
      if (cancelled) return;
      settingsRef.current = s;
      setSettingsState(s);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, [refreshStatus]);

  // Mount (once the settings are known), a new summary (mark, foreground re-read) or a settings/permission change.
  useEffect(() => {
    if (loaded) enqueueSync();
  }, [loaded, summary, settings, status, enqueueSync]);

  useEffect(() => {
    if (!supported) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      // The student may have changed the permission in the phone settings; the day may also have rolled over.
      void refreshStatus().then(enqueueSync);
    });
    return () => sub.remove();
  }, [supported, refreshStatus, enqueueSync]);

  // The permission is asked right after the first solved exercise, at most once ever.
  useEffect(() => {
    if (!supported) return;
    return onFirstOfDay(() => {
      if (settingsRef.current.asked) return;
      const wasUndetermined = statusRef.current === 'undetermined';
      void (async () => {
        await update({ asked: true });
        if (!wasUndetermined) return;
        await requestPermission();
        await refreshStatus();
      })();
    });
  }, [supported, onFirstOfDay, update, refreshStatus]);

  // Scheduled reminders belong to the signed-in student's streak: cancel them on sign-out, on a user switch and when
  // the provider unmounts (sign-out, suspension, terms gate; the next mount reschedules). The settings themselves
  // stay device-wide: one student per phone.
  const prevUser = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevUser.current;
    prevUser.current = userId;
    if (!supported) return;
    if (!userId || (prev && prev !== userId)) chain.current = chain.current.then(cancelReminders).catch(() => {});
  }, [supported, userId]);
  useEffect(
    () => () => {
      if (supported) chain.current = chain.current.then(cancelReminders).catch(() => {});
    },
    [supported],
  );

  useEffect(
    () =>
      onReminderTap(() => {
        // The provider sits in app/(app)/_layout.tsx inside the root Stack, so the navigator is mounted by now.
        try {
          router.replace('/');
        } catch (e) {
          console.warn('[reminders] could not open Home from a notification:', e);
        }
      }),
    [],
  );

  const setEnabled = useCallback(
    async (on: boolean) => {
      await update({ enabled: on });
      if (on && statusRef.current === 'undetermined') {
        await requestPermission();
        await update({ asked: true });
        await refreshStatus();
      }
      // A denied permission cannot be asked again from here: the UI explains the phone settings.
    },
    [update, refreshStatus],
  );

  const setTime = useCallback((time: ReminderTime) => update({ time }), [update]);

  return useMemo(() => ({ settings, status, setEnabled, setTime }), [settings, status, setEnabled, setTime]);
}
