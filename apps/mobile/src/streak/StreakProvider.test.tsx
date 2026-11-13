import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { StreakSummary } from '@prepio/shared';
import { fetchStreak, markActiveToday } from '../lib/streak';
import { StreakProvider, useMarkActive, useStreak } from './StreakProvider';

let mockUser = 'u1';
jest.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ profile: { id: mockUser } }) }));
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
  mockUser = 'u1';
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
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  try {
    jest.setSystemTime(new Date('2026-11-12T10:00:00Z'));
    (markActiveToday as jest.Mock).mockResolvedValue(sum({ current: 6, todayDone: true }));
    (fetchStreak as jest.Mock).mockResolvedValue(sum({ todayDone: true }));
    await renderProvider();
    await act(async () => {});
    await tapMark();
    expect(markActiveToday).not.toHaveBeenCalled();
    jest.setSystemTime(new Date('2026-11-13T10:00:00Z'));
    (fetchStreak as jest.Mock).mockResolvedValue(sum({ todayDone: false }));
    await tapMark();
    expect(markActiveToday).toHaveBeenCalledTimes(1);
    expect(screen.getByText(TOAST)).toBeTruthy();
  } finally {
    jest.useRealTimers();
  }
});

it('another device already recorded today: no mark call, no toast, no listener', async () => {
  (fetchStreak as jest.Mock).mockResolvedValue(sum({ todayDone: true }));
  await renderProvider();
  await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('5'));
  (fetchStreak as jest.Mock).mockClear();
  // The confirmed summary is already done today, so no read and no mark is needed at all.
  await tapMark();
  expect(markActiveToday).not.toHaveBeenCalled();
  expect(screen.queryByText(TOAST)).toBeNull();
  expect(onFirst).not.toHaveBeenCalled();
});

it('a stale not-done summary but the fresh read says done: no mark call, no toast', async () => {
  (fetchStreak as jest.Mock).mockResolvedValueOnce(sum()).mockResolvedValue(sum({ current: 6, todayDone: true }));
  await renderProvider();
  await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('5'));
  await tapMark();
  expect(markActiveToday).not.toHaveBeenCalled();
  expect(screen.queryByText(TOAST)).toBeNull();
  expect(onFirst).not.toHaveBeenCalled();
  expect(screen.getByTestId('current')).toHaveTextContent('6');
});

it('a failed read still marks, but shows no toast', async () => {
  (fetchStreak as jest.Mock).mockResolvedValue(null);
  (markActiveToday as jest.Mock).mockResolvedValue(sum({ current: 6, todayDone: true }));
  await renderProvider();
  await tapMark();
  expect(markActiveToday).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(TOAST)).toBeNull();
  expect(onFirst).not.toHaveBeenCalled();
  expect(screen.getByTestId('current')).toHaveTextContent('6');
});

it('a user switch clears the summary and the toast and drops a stale result', async () => {
  let resolve: (s: StreakSummary) => void = () => {};
  (markActiveToday as jest.Mock).mockReturnValue(new Promise((r) => (resolve = r)));
  const ui = () => (
    <SafeAreaProvider initialMetrics={metrics}>
      <StreakProvider>
        <Probe />
      </StreakProvider>
    </SafeAreaProvider>
  );
  const view = await render(ui());
  await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('5'));
  await tapMark();
  mockUser = 'u2';
  (fetchStreak as jest.Mock).mockResolvedValue(sum({ current: 2 }));
  await act(async () => view.rerender(ui()));
  await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('2'));
  await act(async () => resolve(sum({ current: 6, todayDone: true })));
  expect(screen.getByTestId('current')).toHaveTextContent('2');
  expect(screen.queryByText(TOAST)).toBeNull();
  expect(onFirst).not.toHaveBeenCalled();
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
