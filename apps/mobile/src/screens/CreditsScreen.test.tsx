import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { fetchCreditPackages, fetchLedger, purchaseCredits, type StudentLedgerEntry } from '../lib/credits';
import CreditsScreen from './CreditsScreen';

jest.mock('../credits/CreditsProvider');
const { mockResetCredits, refresh } = jest.requireMock<typeof import('../credits/__mocks__/CreditsProvider')>('../credits/CreditsProvider');
jest.mock('../lib/credits', () => ({
  ...jest.requireActual('../lib/credits'),
  fetchCreditPackages: jest.fn(),
  fetchLedger: jest.fn(),
  purchaseCredits: jest.fn(),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true } }));
const mockedLedger = fetchLedger as jest.Mock;

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const mount = async () =>
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <CreditsScreen />
    </SafeAreaProvider>,
  );

const entry = (id: number, over: Partial<StudentLedgerEntry> = {}): StudentLedgerEntry => ({
  id,
  delta: -2,
  balanceAfter: 40,
  kind: 'check',
  target: null,
  reason: null,
  createdAt: '2026-11-03T10:00:00Z',
  exercise: { type: 'short_answer', prompt: 'p' },
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockResetCredits(49);
  (fetchCreditPackages as jest.Mock).mockResolvedValue([{ id: 'p50', credits: 50, priceBani: 1999, featured: true }]);
  mockedLedger.mockResolvedValue([]);
});

it('shows the balance, the range of checks, refreshes on mount and lists the packages', async () => {
  await mount();
  expect(refresh).toHaveBeenCalled();
  expect(screen.getByText('49')).toBeTruthy();
  expect(screen.getByText('≈ 24–49 verificări')).toBeTruthy();
  expect(screen.getByText('Cumpără credite')).toBeTruthy();
  expect(await screen.findByText('CEL MAI POPULAR')).toBeTruthy();
  expect(screen.queryByText('Verifică acum')).toBeNull();
});

it('lists the history with signed, coloured deltas', async () => {
  mockedLedger.mockResolvedValue([
    entry(3),
    entry(2, { kind: 'purchase', delta: 50, exercise: null }),
    entry(1, { kind: 'welcome', delta: 5, exercise: null }),
  ]);
  await mount();
  expect(await screen.findByText('Credite de bun venit')).toBeTruthy();
  const minus = screen.getByText('−2');
  const plus = screen.getByText('+50');
  expect(JSON.stringify(minus.props.style)).toMatch(/#/);
  expect(JSON.stringify(minus.props.style)).not.toEqual(JSON.stringify(plus.props.style));
  // One day header for the three rows of 3 November, and the balance after each row.
  expect(screen.getAllByText('3 noiembrie 2026')).toHaveLength(1);
  expect(screen.getAllByText('sold 40')).toHaveLength(3);
  expect(screen.queryByText('Încarcă mai multe')).toBeNull();
});

it('empty history', async () => {
  await mount();
  expect(await screen.findByText('Încă nu ai folosit credite.')).toBeTruthy();
});

it('a full page offers „Încarcă mai multe”, which asks for rows before the last id', async () => {
  const page = Array.from({ length: 30 }, (_, i) => entry(100 - i));
  mockedLedger.mockResolvedValueOnce(page).mockResolvedValueOnce([entry(70)]);
  await mount();
  await fireEvent.press(await screen.findByRole('button', { name: 'Încarcă mai multe' }));
  expect(mockedLedger).toHaveBeenLastCalledWith({ before: 71 });
  expect(await screen.findAllByText('−2')).toHaveLength(31);
  expect(screen.queryByText('Încarcă mai multe')).toBeNull();
});

it('after a purchase the buy button is usable again and the history reloads from the top', async () => {
  (purchaseCredits as jest.Mock).mockResolvedValue({ orderId: 'o1', credits: 50, balance: 99 });
  mockedLedger.mockResolvedValueOnce([]).mockResolvedValueOnce([entry(9, { kind: 'purchase', delta: 50, exercise: null })]);
  await mount();
  await act(async () => void fireEvent.press(await screen.findByRole('button', { name: 'Cumpără 50 de credite · 19,99 lei' })));
  expect(purchaseCredits).toHaveBeenCalledWith('p50');
  expect(screen.getByRole('button', { name: 'Cumpără 50 de credite · 19,99 lei' })).toBeEnabled();
  expect(mockedLedger).toHaveBeenCalledTimes(2);
  expect(mockedLedger).toHaveBeenLastCalledWith();
  expect(await screen.findByText('+50')).toBeTruthy();
  expect(screen.getByText('99')).toBeTruthy();
});

it('shows a placeholder while the balance is unknown', async () => {
  mockResetCredits(null);
  await mount();
  expect(screen.getByText('—')).toBeTruthy();
  expect(screen.queryByText(/≈/)).toBeNull();
});

it('groups the history by day', async () => {
  mockedLedger.mockResolvedValue([entry(3, { createdAt: '2026-11-05T10:00:00Z' }), entry(2), entry(1)]);
  await mount();
  expect(await screen.findByText('5 noiembrie 2026')).toBeTruthy();
  expect(screen.getByText('3 noiembrie 2026')).toBeTruthy();
});
