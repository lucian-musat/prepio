import { StyleSheet } from 'react-native';
import { fireEvent, render as rtlRender, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { color, type StreakSummary } from '@prepio/shared';
import StreakPill from './StreakPill';
import HeaderPills from './HeaderPills';

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const render = (ui: ReactElement) => rtlRender(<SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>);

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../credits/CreditChip', () => ({ __esModule: true, default: () => null }));
let mockSummary: StreakSummary | null = null;
jest.mock('./StreakProvider', () => ({ useStreak: () => ({ summary: mockSummary }) }));

const summary = (current: number): StreakSummary => ({ current, record: 9, todayDone: false, week: [] });

it('alive streak: „🔥 5” on the yellow tint with its label', async () => {
  mockSummary = summary(5);
  await render(<StreakPill />);
  const pill = screen.getByRole('button', { name: 'Serie de 5 zile, deschide detaliile' });
  expect(StyleSheet.flatten(pill.props.style).backgroundColor).toBe(color.accentSubtle);
  expect(StyleSheet.flatten(screen.getByText('🔥 5').props.style).color).toBe(color.onAccent);
});

it('no streak: „🔥 0” muted', async () => {
  mockSummary = summary(0);
  await render(<StreakPill />);
  expect(StyleSheet.flatten(screen.getByTestId('streak-pill').props.style).backgroundColor).toBe(color.surfaceMuted);
  expect(StyleSheet.flatten(screen.getByText('🔥 0').props.style).color).toBe(color.textMuted);
});

it('unknown streak: renders nothing', async () => {
  mockSummary = null;
  await render(<HeaderPills />);
  expect(screen.queryByTestId('streak-pill')).toBeNull();
});

it('tapping the pill opens the details sheet', async () => {
  mockSummary = summary(5);
  await render(<StreakPill />);
  expect(screen.queryByTestId('streak-sheet')).toBeNull();
  await fireEvent.press(screen.getByTestId('streak-pill'));
  expect(screen.getByText('🔥 5 zile la rând')).toBeTruthy();
});
