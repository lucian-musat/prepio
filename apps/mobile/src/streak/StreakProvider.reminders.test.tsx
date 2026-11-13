import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import type { StreakSummary } from '@prepio/shared';
import { fetchStreak, markActiveToday } from '../lib/streak';
import { loadReminderSettings, saveReminderSettings } from './reminderSettings';
import { canAskAgain, cancelReminders, onReminderTap, permission, remindersSupported, requestPermission, syncReminders } from './reminders';
import { StreakProvider, useMarkActive, useReminders } from './StreakProvider';

let mockUser: string | null = 'u1';
jest.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ profile: mockUser ? { id: mockUser } : null }) }));
jest.mock('../lib/streak', () => ({ fetchStreak: jest.fn(), markActiveToday: jest.fn() }));
jest.mock('./reminders', () => ({
  remindersSupported: jest.fn(),
  permission: jest.fn(),
  canAskAgain: jest.fn(),
  requestPermission: jest.fn(),
  syncReminders: jest.fn(),
  onReminderTap: jest.fn(),
  cancelReminders: jest.fn(),
}));
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));

const sum = (over: Partial<StreakSummary> = {}): StreakSummary => ({ current: 5, record: 9, todayDone: false, week: [], ...over });
const metrics = { frame: { x: 0, y: 0, width: 360, height: 640 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const m = (f: unknown) => f as jest.Mock;

let onChange: (s: string) => void = () => {};
let tap: () => void = () => {};
let api: ReturnType<typeof useReminders>;
function Probe() {
  const mark = useMarkActive();
  api = useReminders();
  return (
    <>
      <Text testID="status">{api.status}</Text>
      <Text testID="enabled">{String(api.settings.enabled)}</Text>
      <Text onPress={mark}>mark</Text>
    </>
  );
}
const renderProvider = async () =>
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <StreakProvider>
        <Probe />
      </StreakProvider>
    </SafeAreaProvider>,
  );
const tapMark = async () => {
  await act(async () => {
    fireEvent.press(screen.getByText('mark'));
  });
};
const lastSync = () => m(syncReminders).mock.calls.at(-1)!;

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  m(remindersSupported).mockReturnValue(true);
  m(permission).mockResolvedValue('granted');
  m(requestPermission).mockResolvedValue(true);
  m(canAskAgain).mockResolvedValue(true);
  m(syncReminders).mockResolvedValue(undefined);
  m(cancelReminders).mockResolvedValue(undefined);
  mockUser = 'u1';
  m(onReminderTap).mockImplementation((cb: () => void) => {
    tap = cb;
    return () => {};
  });
  m(fetchStreak).mockResolvedValue(sum());
  m(markActiveToday).mockResolvedValue(sum({ current: 6, todayDone: true }));
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_t, cb) => {
    onChange = cb as (s: string) => void;
    return { remove: jest.fn() } as never;
  });
});
afterEach(() => jest.restoreAllMocks());

it('syncs on mount with the loaded settings and the confirmed summary', async () => {
  await renderProvider();
  await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('granted'));
  await waitFor(() => expect(lastSync()[0]).toEqual(sum()));
  expect(lastSync()[1]).toEqual({ enabled: true, time: { hour: 19, minute: 0 }, asked: false });
});

it('syncs again when the app returns to the foreground, re-reading the permission', async () => {
  await renderProvider();
  await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('granted'));
  m(permission).mockResolvedValue('denied');
  m(syncReminders).mockClear();
  await act(async () => onChange('active'));
  await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('denied'));
  expect(syncReminders).toHaveBeenCalled();
});

it('syncs after a mark with the new summary', async () => {
  await renderProvider();
  await waitFor(() => expect(lastSync()[0]).toEqual(sum()));
  await tapMark();
  await waitFor(() => expect(lastSync()[0]).toEqual(sum({ current: 6, todayDone: true })));
});

it('asks for permission once after the first exercise of the day and remembers it', async () => {
  m(permission).mockResolvedValue('undetermined');
  await renderProvider();
  await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('undetermined'));
  m(permission).mockResolvedValue('granted');
  await tapMark();
  await waitFor(() => expect(requestPermission).toHaveBeenCalledTimes(1));
  await waitFor(async () => expect((await loadReminderSettings()).asked).toBe(true));
  await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('granted'));
});

it('a refused permission shows status denied, keeps the switch value and is never asked again automatically', async () => {
  m(permission).mockResolvedValue('undetermined');
  m(requestPermission).mockResolvedValue(false);
  await renderProvider();
  await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('undetermined'));
  m(permission).mockResolvedValue('denied');
  await tapMark();
  await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('denied'));
  expect(screen.getByTestId('enabled')).toHaveTextContent('true');
  expect((await loadReminderSettings()).asked).toBe(true);
});

it('does not prompt automatically when it was asked before', async () => {
  await saveReminderSettings({ enabled: true, time: { hour: 19, minute: 0 }, asked: true });
  m(permission).mockResolvedValue('undetermined');
  await renderProvider();
  await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('undetermined'));
  await tapMark();
  expect(requestPermission).not.toHaveBeenCalled();
});

it('setEnabled(true) while undetermined asks for permission', async () => {
  await saveReminderSettings({ enabled: false, time: { hour: 19, minute: 0 }, asked: false });
  m(permission).mockResolvedValue('undetermined');
  await renderProvider();
  await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('undetermined'));
  m(permission).mockResolvedValue('granted');
  await act(async () => api.setEnabled(true));
  expect(requestPermission).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('status')).toHaveTextContent('granted');
  expect(screen.getByTestId('enabled')).toHaveTextContent('true');
  expect(lastSync()[1]).toMatchObject({ enabled: true, asked: true });
});

it('setEnabled(true) while denied for good does not ask; setEnabled(false) turns off and syncs', async () => {
  m(canAskAgain).mockResolvedValue(false);
  m(permission).mockResolvedValue('denied');
  await renderProvider();
  await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('denied'));
  await act(async () => api.setEnabled(true));
  expect(requestPermission).not.toHaveBeenCalled();
  expect(screen.getByTestId('status')).toHaveTextContent('denied');
  await act(async () => api.setEnabled(false));
  expect(screen.getByTestId('enabled')).toHaveTextContent('false');
  await waitFor(() => expect(lastSync()[1]).toMatchObject({ enabled: false }));
  expect((await loadReminderSettings()).enabled).toBe(false);
});

it('setTime saves the time and syncs with it', async () => {
  await renderProvider();
  await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('granted'));
  await act(async () => api.setTime({ hour: 8, minute: 30 }));
  await waitFor(() => expect(lastSync()[1].time).toEqual({ hour: 8, minute: 30 }));
  expect((await loadReminderSettings()).time).toEqual({ hour: 8, minute: 30 });
});

it('reports unsupported when the platform has no reminders', async () => {
  m(remindersSupported).mockReturnValue(false);
  await renderProvider();
  expect(screen.getByTestId('status')).toHaveTextContent('unsupported');
});

it('opens Home when a reminder is tapped', async () => {
  await renderProvider();
  await act(async () => tap());
  expect(router.replace).toHaveBeenCalledWith('/');
});

it('a failing router.replace on a tap does not throw', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  m(router.replace).mockImplementationOnce(() => {
    throw new Error('not ready');
  });
  await renderProvider();
  expect(() => tap()).not.toThrow();
});

it('cancels all reminders when the provider unmounts', async () => {
  const view = await renderProvider();
  await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('granted'));
  m(cancelReminders).mockClear();
  await act(async () => view.unmount());
  await waitFor(() => expect(cancelReminders).toHaveBeenCalledTimes(1));
});

it('cancels all reminders when the user signs out', async () => {
  const ui = () => (
    <SafeAreaProvider initialMetrics={metrics}>
      <StreakProvider>
        <Probe />
      </StreakProvider>
    </SafeAreaProvider>
  );
  const view = await render(ui());
  await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('granted'));
  expect(cancelReminders).not.toHaveBeenCalled();
  mockUser = null;
  await act(async () => view.rerender(ui()));
  await waitFor(() => expect(cancelReminders).toHaveBeenCalledTimes(1));
});

it('a user switch cancels before the new user schedules', async () => {
  const ui = () => (
    <SafeAreaProvider initialMetrics={metrics}>
      <StreakProvider>
        <Probe />
      </StreakProvider>
    </SafeAreaProvider>
  );
  const view = await render(ui());
  await waitFor(() => expect(lastSync()[0]).toEqual(sum()));
  m(syncReminders).mockClear();
  mockUser = 'u2';
  m(fetchStreak).mockResolvedValue(sum({ current: 2 }));
  await act(async () => view.rerender(ui()));
  await waitFor(() => expect(cancelReminders).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(lastSync()[0]).toEqual(sum({ current: 2 })));
  expect(m(cancelReminders).mock.invocationCallOrder[0]).toBeLessThan(m(syncReminders).mock.invocationCallOrder.at(-1)!);
});

it('a permission() error (reported as undetermined) does not trigger a second automatic prompt', async () => {
  await saveReminderSettings({ enabled: true, time: { hour: 19, minute: 0 }, asked: true });
  m(permission).mockResolvedValue('undetermined');
  await renderProvider();
  await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('undetermined'));
  await tapMark();
  expect(requestPermission).not.toHaveBeenCalled();
});

it('setEnabled(true) while denied but Android can still ask, asks again', async () => {
  await saveReminderSettings({ enabled: false, time: { hour: 19, minute: 0 }, asked: true });
  m(permission).mockResolvedValue('denied');
  m(canAskAgain).mockResolvedValue(true);
  await renderProvider();
  await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('denied'));
  expect(api.canAskAgain).toBe(true);
  m(permission).mockResolvedValue('granted');
  await act(async () => api.setEnabled(true));
  expect(requestPermission).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('status')).toHaveTextContent('granted');
});

it('schedules nothing after the provider unmounted', async () => {
  const view = await renderProvider();
  await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('granted'));
  await act(async () => view.unmount());
  m(syncReminders).mockClear();
  await act(async () => onChange('active'));
  expect(syncReminders).not.toHaveBeenCalled();
});

describe('the day rolls over while the app is open', () => {
  const REAL = ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'nextTick', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'hrtime'] as const;
  afterEach(() => jest.useRealTimers());

  it('a summary confirmed yesterday is synced as not done today, even when the re-read never answers', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-11T10:00:00Z'), doNotFake: [...REAL] });
    m(fetchStreak).mockResolvedValueOnce(sum({ todayDone: true, week: ['2026-11-11'] }));
    await renderProvider();
    await waitFor(() => expect(lastSync()[0]).toEqual(sum({ todayDone: true, week: ['2026-11-11'] })));
    jest.setSystemTime(new Date('2026-11-12T10:00:00Z'));
    m(fetchStreak).mockReturnValue(new Promise(() => {}));
    m(syncReminders).mockClear();
    await act(async () => onChange('active'));
    await waitFor(() => expect(syncReminders).toHaveBeenCalled());
    expect(lastSync()[0]).toEqual(sum({ todayDone: false, week: ['2026-11-11'] }));
  });
});
