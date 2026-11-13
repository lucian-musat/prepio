import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import type { StreakSummary } from '@prepio/shared';
import { fetchStreak, markActiveToday } from '../lib/streak';
import { loadReminderSettings, saveReminderSettings } from './reminderSettings';
import { onReminderTap, permission, remindersSupported, requestPermission, syncReminders } from './reminders';
import { StreakProvider, useMarkActive, useReminders } from './StreakProvider';

jest.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ profile: { id: 'u1' } }) }));
jest.mock('../lib/streak', () => ({ fetchStreak: jest.fn(), markActiveToday: jest.fn() }));
jest.mock('./reminders', () => ({
  remindersSupported: jest.fn(),
  permission: jest.fn(),
  requestPermission: jest.fn(),
  syncReminders: jest.fn(),
  onReminderTap: jest.fn(),
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
  m(syncReminders).mockResolvedValue(undefined);
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

it('setEnabled(true) while denied does not ask; setEnabled(false) turns off and syncs', async () => {
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
