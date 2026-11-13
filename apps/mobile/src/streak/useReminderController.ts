import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { router } from 'expo-router';
import { DEFAULT_REMINDER, type ReminderTime, type StreakSummary } from '@prepio/shared';
import { loadReminderSettings, saveReminderSettings, type PermissionStatus, type ReminderSettings } from './reminderSettings';
import { canAskAgain, cancelReminders, onReminderTap, permission, remindersSupported, requestPermission, syncReminders } from './reminders';

export type ReminderStatus = PermissionStatus | 'unsupported';

export type RemindersValue = {
  settings: ReminderSettings;
  /** The system permission; 'unsupported' on web or when this build has no notifications module. */
  status: ReminderStatus;
  /** False once Android no longer shows the permission prompt; the student must use the phone settings. */
  canAskAgain: boolean;
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
  /** The summary normalized to the Bucharest day it is read on (a foreground sync must not use a stale render's one). */
  getSummary: () => StreakSummary | null,
): RemindersValue {
  const supported = remindersSupported();
  const [settings, setSettingsState] = useState<ReminderSettings>(INITIAL);
  const [status, setStatus] = useState<ReminderStatus>(supported ? 'undetermined' : 'unsupported');
  const [askAgain, setAskAgain] = useState(true);
  const askAgainRef = useRef(true);
  const [loaded, setLoaded] = useState(false);
  const settingsRef = useRef(settings);
  const statusRef = useRef(status);
  const mounted = useRef(true);
  /** Syncs run one after another: a cancel-then-schedule pair must never interleave with another. */
  const chain = useRef<Promise<void>>(Promise.resolve());
  settingsRef.current = settings;
  statusRef.current = status;
  const enqueueSync = useCallback(() => {
    if (!supported || !mounted.current) return;
    const s = getSummary();
    const st = settingsRef.current;
    chain.current = chain.current.then(() => syncReminders(s, st)).catch(() => {});
  }, [supported, getSummary]);

  const refreshStatus = useCallback(async () => {
    if (!supported) return;
    const [next, again] = await Promise.all([permission(), canAskAgain()]);
    if (mounted.current) {
      statusRef.current = next;
      askAgainRef.current = again;
      setAskAgain(again);
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
      const st = statusRef.current;
      if (on && (st === 'undetermined' || (st === 'denied' && askAgainRef.current))) {
        await requestPermission();
        await update({ asked: true });
        await refreshStatus();
      }
      // Once Android no longer shows the prompt (canAskAgain false) the UI explains the phone settings.
    },
    [update, refreshStatus],
  );

  const setTime = useCallback((time: ReminderTime) => update({ time }), [update]);

  return useMemo(() => ({ settings, status, canAskAgain: askAgain, setEnabled, setTime }), [settings, status, askAgain, setEnabled, setTime]);
}
