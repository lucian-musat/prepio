import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { StreakSummary } from '@prepio/shared';
import { fetchStreak, markActiveToday } from '../lib/streak';
import { StreakProvider, useMarkActive, useStreak } from './StreakProvider';

jest.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ profile: { id: 'u1' } }) }));
jest.mock('../lib/streak', () => ({ fetchStreak: jest.fn(), markActiveToday: jest.fn() }));

const sum = (over: Partial<StreakSummary> = {}): StreakSummary => ({ current: 5, record: 9, todayDone: false, week: [], ...over });
const TOAST = '🔥 Seria continuă: 6 zile! Ne vedem mâine.';
const metrics = { frame: { x: 0, y: 0, width: 360, height: 640 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

let onFirst: jest.Mock;
let onChange: (s: string) => void = () => {};
function Probe() {
  const { summary, onFirstOfDay } = useStreak();
  const mark = useMarkActive();
  onFirstOfDay(onFirst);
  return (
    <>
      <Text testID="current">{summary ? String(summary.current) : 'none'}</Text>
      <Text onPress={mark}>mark</Text>
    </>
  );
}

async function renderProvider() {
  return await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <StreakProvider>
        <Probe />
      </StreakProvider>
    </SafeAreaProvider>,
  );
}
const tapMark = async () => {
  await act(async () => {
    fireEvent.press(screen.getByText('mark'));
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  onFirst = jest.fn();
  (fetchStreak as jest.Mock).mockResolvedValue(sum());
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_t, cb) => {
    onChange = cb as (s: string) => void;
    return { remove: jest.fn() } as never;
  });
});

afterEach(() => jest.restoreAllMocks());

it('loads the streak on mount and when the app returns to the foreground', async () => {
  await renderProvider();
  await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('5'));
  (fetchStreak as jest.Mock).mockResolvedValue(sum({ current: 7 }));
  await act(async () => onChange('active'));
  await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('7'));
  expect(fetchStreak).toHaveBeenCalledTimes(2);
});

it('shows the toast and notifies listeners when a mark turns today done; a second mark skips the call', async () => {
  (markActiveToday as jest.Mock).mockResolvedValue(sum({ current: 6, todayDone: true }));
  await renderProvider();
  await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('5'));
  await tapMark();
  expect(screen.getByText(TOAST)).toBeTruthy();
  expect(onFirst).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('current')).toHaveTextContent('6');
  expect(markActiveToday).toHaveBeenCalledTimes(1);

  await tapMark();
  expect(markActiveToday).toHaveBeenCalledTimes(1);
  expect(onFirst).toHaveBeenCalledTimes(1);
});

it('hides the toast after about three seconds', async () => {
  (markActiveToday as jest.Mock).mockResolvedValue(sum({ current: 6, todayDone: true }));
  await renderProvider();
  await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('5'));
  jest.useFakeTimers();
  try {
    await tapMark();
    expect(screen.getByText(TOAST)).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(3100);
    });
    expect(screen.queryByText(TOAST)).toBeNull();
  } finally {
    jest.useRealTimers();
  }
});

it('does not fire a second call while one is in flight', async () => {
  let resolve: (s: StreakSummary) => void = () => {};
  (markActiveToday as jest.Mock).mockReturnValue(new Promise((r) => (resolve = r)));
  await renderProvider();
  await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('5'));
  await tapMark();
  await tapMark();
  expect(markActiveToday).toHaveBeenCalledTimes(1);
  await act(async () => resolve(sum({ current: 6, todayDone: true })));
});

it('keeps a failed mark retryable: no toast, summary unchanged', async () => {
  (markActiveToday as jest.Mock).mockResolvedValueOnce(null).mockResolvedValueOnce(sum({ current: 6, todayDone: true }));
  await renderProvider();
  await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('5'));
  await tapMark();
  expect(screen.queryByText(TOAST)).toBeNull();
  expect(screen.getByTestId('current')).toHaveTextContent('5');
  await tapMark();
  expect(markActiveToday).toHaveBeenCalledTimes(2);
  expect(screen.getByText(TOAST)).toBeTruthy();
});

it('marks again on a new Bucharest day even if the stored summary was done', async () => {
  const now = jest.spyOn(Date, 'now');
  const RealDate = Date;
  let clock = new RealDate('2026-11-12T10:00:00Z');
  // bucharestDay(new Date()) reads the system time: pin `new Date()` to a controllable clock.
  const spy = jest.spyOn(global, 'Date').mockImplementation(((...a: unknown[]) => (a.length ? new RealDate(...(a as [string])) : new RealDate(clock))) as never);
  Object.assign(global.Date, { now: () => clock.getTime() });
  try {
    (fetchStreak as jest.Mock).mockResolvedValue(sum({ todayDone: true }));
    (markActiveToday as jest.Mock).mockResolvedValue(sum({ current: 6, todayDone: true }));
    await renderProvider();
    await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('5'));
    await tapMark();
    expect(markActiveToday).not.toHaveBeenCalled();
    clock = new RealDate('2026-11-13T10:00:00Z');
    await tapMark();
    expect(markActiveToday).toHaveBeenCalledTimes(1);
    expect(screen.getByText(TOAST)).toBeTruthy();
  } finally {
    spy.mockRestore();
    now.mockRestore();
  }
});

it('useMarkActive is a no-op outside the provider', async () => {
  function Alone() {
    const mark = useMarkActive();
    return <Text onPress={mark}>mark</Text>;
  }
  await render(<Alone />);
  await fireEvent.press(screen.getByText('mark'));
  expect(markActiveToday).not.toHaveBeenCalled();
});

it('useStreak throws outside the provider', async () => {
  const err = jest.spyOn(console, 'error').mockImplementation(() => {});
  function Bad() {
    useStreak();
    return null;
  }
  await expect(render(<Bad />)).rejects.toThrow(/StreakProvider/);
  err.mockRestore();
});
