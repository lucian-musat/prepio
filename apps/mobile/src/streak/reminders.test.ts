import * as N from 'expo-notifications';
import { planReminders, type StreakSummary } from '@prepio/shared';
// Jest runs with the native platform, so './reminders' resolves to reminders.native.ts.
import { onReminderTap, permission, remindersSupported, requestPermission, syncReminders } from './reminders';

const mock = N as unknown as Record<string, jest.Mock>;
const sum = (over: Partial<StreakSummary> = {}): StreakSummary => ({ current: 5, record: 9, todayDone: false, week: [], ...over });
const on = { enabled: true, time: { hour: 19, minute: 0 }, asked: true };
const now = new Date(2026, 10, 13, 10, 0);

beforeEach(() => {
  jest.clearAllMocks();
  mock.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
  mock.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
});

describe('syncReminders', () => {
  it('cancels, then schedules the planned reminders on the daily-reminder channel', async () => {
    await syncReminders(sum(), on, now);
    const planned = planReminders(now, on.time, sum());
    expect(planned).toHaveLength(7);
    expect(mock.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(mock.scheduleNotificationAsync).toHaveBeenCalledTimes(7);
    planned.forEach((p, i) =>
      expect(mock.scheduleNotificationAsync.mock.calls[i][0]).toEqual({
        content: { title: p.title, body: p.body },
        trigger: { type: 'date', date: p.at, channelId: 'daily-reminder' },
      }),
    );
    expect(mock.cancelAllScheduledNotificationsAsync.mock.invocationCallOrder[0]).toBeLessThan(
      mock.scheduleNotificationAsync.mock.invocationCallOrder[0],
    );
  });

  it('skips today when today is done (6 reminders)', async () => {
    await syncReminders(sum({ todayDone: true }), on, now);
    expect(mock.scheduleNotificationAsync).toHaveBeenCalledTimes(6);
  });

  it('only cancels when the switch is off', async () => {
    await syncReminders(sum(), { ...on, enabled: false }, now);
    expect(mock.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(mock.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('only cancels when the permission is denied', async () => {
    mock.getPermissionsAsync.mockResolvedValue({ status: 'denied' });
    await syncReminders(sum(), on, now);
    expect(mock.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(mock.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('leaves the existing reminders alone while the streak is unknown', async () => {
    await syncReminders(null, on, now);
    expect(mock.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
    expect(mock.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('never throws when the native call fails', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mock.cancelAllScheduledNotificationsAsync.mockRejectedValueOnce(new Error('boom'));
    await expect(syncReminders(sum(), on, now)).resolves.toBeUndefined();
  });
});

describe('permission', () => {
  it('maps the status and requests through the module', async () => {
    expect(remindersSupported()).toBe(true);
    mock.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    expect(await permission()).toBe('undetermined');
    mock.requestPermissionsAsync.mockResolvedValue({ status: 'denied' });
    expect(await requestPermission()).toBe(false);
    mock.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
    expect(await requestPermission()).toBe(true);
  });
});

describe('onReminderTap', () => {
  it('fires on a tap and unsubscribes', async () => {
    const remove = jest.fn();
    mock.addNotificationResponseReceivedListener.mockReturnValueOnce({ remove });
    const cb = jest.fn();
    const off = onReminderTap(cb);
    mock.addNotificationResponseReceivedListener.mock.calls[0][0]({});
    expect(cb).toHaveBeenCalledTimes(1);
    off();
    expect(remove).toHaveBeenCalled();
  });

  it('fires once for the tap that launched the app', async () => {
    mock.getLastNotificationResponseAsync.mockResolvedValueOnce({});
    const cb = jest.fn();
    onReminderTap(cb);
    await new Promise((r) => setTimeout(r, 0));
    expect(cb).toHaveBeenCalledTimes(1);
    expect(mock.clearLastNotificationResponseAsync).toHaveBeenCalled();
  });
});

describe('without the native module', () => {
  it('is unsupported and does not crash', async () => {
    jest.resetModules();
    jest.doMock('expo-notifications', () => {
      throw new Error('Cannot find native module ExpoNotifications');
    });
    const r = require('./reminders') as typeof import('./reminders');
    expect(r.remindersSupported()).toBe(false);
    expect(await r.permission()).toBe('undetermined');
    expect(await r.requestPermission()).toBe(false);
    await expect(r.syncReminders(sum(), on, now)).resolves.toBeUndefined();
    expect(() => r.onReminderTap(() => {})()).not.toThrow();
    jest.dontMock('expo-notifications');
  });
});

describe('web no-op', () => {
  it('reports unsupported without touching expo-notifications', async () => {
    jest.resetModules();
    const r = require('./reminders.ts') as typeof import('./reminders');
    expect(r.remindersSupported()).toBe(false);
    expect(await r.permission()).toBe('undetermined');
    await r.syncReminders(sum(), on, now);
  });
});

describe('permission errors', () => {
  it('reports undetermined when the native check throws', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mock.getPermissionsAsync.mockRejectedValueOnce(new Error('boom'));
    expect(await permission()).toBe('undetermined');
  });
});
