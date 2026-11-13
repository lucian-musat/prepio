import { StyleSheet } from 'react-native';
import * as RN from 'react-native';
import { fireEvent, render as rtlRender, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { bucharestDay, color, weekDays, type StreakSummary } from '@prepio/shared';
import StreakSheet from './StreakSheet';

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const render = (ui: ReactElement) => rtlRender(<SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>);

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
let mockSummary: StreakSummary | null = null;
jest.mock('./StreakProvider', () => ({ useStreak: () => ({ summary: mockSummary }) }));

const today = bucharestDay(new Date());
const days = weekDays(today);
const summary = (over: Partial<StreakSummary> = {}): StreakSummary => ({ current: 5, record: 9, todayDone: false, week: [], ...over });

beforeEach(() => {
  (router.push as jest.Mock).mockReset();
  (RN.Platform as { OS: string }).OS = 'android';
  mockSummary = summary();
});

const dot = (d: string) => StyleSheet.flatten(screen.getByTestId(`streak-day-${d}`).props.style);

it('shows the headline, the record and the week letters', async () => {
  await render(<StreakSheet visible onClose={() => {}} />);
  expect(screen.getByText('🔥 5 zile la rând')).toBeTruthy();
  expect(screen.getByText('Recordul tău: 9 zile')).toBeTruthy();
  expect(screen.getAllByText('M')).toHaveLength(2);
  for (const l of ['L', 'J', 'V', 'S', 'D']) expect(screen.getAllByText(l)).toHaveLength(1);
});

it('uses the singular for one day', async () => {
  mockSummary = summary({ current: 1, record: 1 });
  await render(<StreakSheet visible onClose={() => {}} />);
  expect(screen.getByText('🔥 1 zi la rând')).toBeTruthy();
  expect(screen.getByText('Recordul tău: 1 zi')).toBeTruthy();
});

it('marks worked days, dashes today until worked, leaves the rest empty', async () => {
  mockSummary = summary({ week: [days[0]] });
  await render(<StreakSheet visible onClose={() => {}} />);
  const todayIdx = days.indexOf(today);
  expect(dot(days[0]).backgroundColor).toBe(color.accent);
  expect(screen.getAllByText('✓')).toHaveLength(1);
  if (todayIdx !== 0) {
    expect(dot(today).borderStyle).toBe('dashed');
    expect(dot(today).borderColor).toBe(color.primary);
  }
  const other = days.find((d) => d !== today && d !== days[0])!;
  expect(dot(other).backgroundColor).toBe(color.surfaceMuted);
  expect(dot(other).borderStyle).toBeUndefined();
});

it('today worked: filled with a check, no hint, no solve button', async () => {
  mockSummary = summary({ todayDone: true, week: [today] });
  await render(<StreakSheet visible onClose={() => {}} onSolve={() => {}} />);
  expect(dot(today).backgroundColor).toBe(color.accent);
  expect(screen.queryByText(/Azi încă n-ai lucrat/)).toBeNull();
  expect(screen.queryByText('Rezolvă un exercițiu')).toBeNull();
});

it('a summary from a previous day is not "done today"', async () => {
  mockSummary = summary({ todayDone: true, week: [] });
  await render(<StreakSheet visible onClose={() => {}} onSolve={() => {}} />);
  expect(screen.getByText(/Azi încă n-ai lucrat/)).toBeTruthy();
  expect(dot(today).borderStyle).toBe('dashed');
});

it('before working today: hint, and a solve button that closes then calls onSolve', async () => {
  const calls: string[] = [];
  await render(<StreakSheet visible onClose={() => calls.push('close')} onSolve={() => calls.push('solve')} />);
  expect(screen.getByText('Azi încă n-ai lucrat. Un singur exercițiu păstrează seria.')).toBeTruthy();
  await fireEvent.press(screen.getByText('Rezolvă un exercițiu'));
  expect(calls).toEqual(['close', 'solve']);
});

it('no solve button without onSolve (the hint stays)', async () => {
  await render(<StreakSheet visible onClose={() => {}} />);
  expect(screen.getByText(/Azi încă n-ai lucrat/)).toBeTruthy();
  expect(screen.queryByText('Rezolvă un exercițiu')).toBeNull();
});

it('„Setări memento” closes the sheet and opens /profile on the phone', async () => {
  const onClose = jest.fn();
  await render(<StreakSheet visible onClose={onClose} />);
  await fireEvent.press(screen.getByText('Setări memento'));
  expect(onClose).toHaveBeenCalled();
  expect(router.push).toHaveBeenCalledWith('/profile');
});

it('„Setări memento” is hidden on web', async () => {
  (RN.Platform as { OS: string }).OS = 'web';
  await render(<StreakSheet visible onClose={() => {}} />);
  expect(screen.queryByText('Setări memento')).toBeNull();
});
