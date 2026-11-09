import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import BacListScreen from './BacListScreen';
import { fetchBacList, type BacListRow } from '../../lib/bac';

jest.mock('../../access/AccessProvider');
jest.mock('../../credits/CreditsProvider');
jest.mock('../../lib/access', () => ({ ...jest.requireActual('../../lib/access'), purchaseAccess: jest.fn() }));
jest.mock('../../lib/bac', () => ({ fetchBacList: jest.fn() }));
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    router: { push: jest.fn(), setParams: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (cb: () => void | (() => void)) => {
      useEffect(() => cb(), [cb]);
    },
  };
});
const { mockResetAccess } = jest.requireMock<typeof import('../../access/__mocks__/AccessProvider')>('../../access/AccessProvider');
const { mockResetCredits } = jest.requireMock<typeof import('../../credits/__mocks__/CreditsProvider')>('../../credits/CreditsProvider');
let mockParams: { paywall?: string } = {};
const mockedFetch = fetchBacList as jest.Mock;

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const renderList = async () =>
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <BacListScreen />
    </SafeAreaProvider>,
  );

const row = (over: Partial<BacListRow>): BacListRow => ({
  id: 'a',
  title: 'Model 1',
  year: 2026,
  variant: '1',
  creditCost: 10,
  state: 'new',
  lastGrade: null,
  position: null,
  ...over,
});
const ROWS = [
  row({ id: 'a', title: 'Subiect A' }),
  row({ id: 'b', title: 'Subiect B', state: 'draft', position: { section: 2, index: 2 } }),
  row({ id: 'c', title: 'Subiect C', year: 2025, state: 'grading' }),
  row({ id: 'd', title: 'Subiect D', year: 2025, state: 'failed' }),
  row({ id: 'e', title: 'Subiect E', year: 2025, state: 'completed', lastGrade: 8.4 }),
];
const FULL = { accessUntil: new Date(Date.now() + 40 * 86400000).toISOString() };

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockResetAccess(FULL);
  mockResetCredits(5);
  mockedFetch.mockResolvedValue(ROWS);
});

it('renders rows grouped by year with each state chip', async () => {
  await renderList();
  expect(await screen.findByText('Istorie · 2026')).toBeTruthy();
  expect(screen.getByText('Istorie · 2025')).toBeTruthy();
  expect(screen.getByText('Neînceput')).toBeTruthy();
  expect(screen.getByText('În lucru · Subiectul II, cerința 3')).toBeTruthy();
  expect(screen.getByText('Se corectează…')).toBeTruthy();
  expect(screen.getByText('Corectarea nu a reușit')).toBeTruthy();
  expect(screen.getByText('✓ Completat · 8,40')).toBeTruthy();
  expect(screen.queryByText('🔒')).toBeNull();
});

it('opens the subject for a student with full access', async () => {
  await renderList();
  fireEvent.press(await screen.findByText('Subiect A'));
  expect(router.push).toHaveBeenCalledWith('/bac/a');
});

it('a completed subject opens its latest result; draft, grading and failed open the paper', async () => {
  await renderList();
  await fireEvent.press(await screen.findByText('Subiect E'));
  expect(router.push).toHaveBeenLastCalledWith('/bac/e/rezultat');
  for (const [title, id] of [['Subiect B', 'b'], ['Subiect C', 'c'], ['Subiect D', 'd']] as const) {
    await fireEvent.press(screen.getByText(title));
    expect(router.push).toHaveBeenLastCalledWith(`/bac/${id}`);
  }
});

it('opens the paywall instead of navigating when the plan does not include it', async () => {
  mockResetAccess({ accessUntil: null });
  await renderList();
  fireEvent.press(await screen.findByText('Subiect A'));
  expect(router.push).not.toHaveBeenCalled();
  expect(await screen.findByText('Mai târziu')).toBeTruthy();
  expect(screen.getAllByText('🔒').length).toBe(ROWS.length);
});

it('shows the empty state', async () => {
  mockedFetch.mockResolvedValue([]);
  await renderList();
  expect(await screen.findByText('Nu există încă subiecte publicate.')).toBeTruthy();
});

it('shows the error state and retries', async () => {
  mockedFetch.mockRejectedValueOnce(new Error('x'));
  await renderList();
  fireEvent.press(await screen.findByText('Reîncearcă'));
  await waitFor(() => expect(screen.getByText('Subiect A')).toBeTruthy());
  expect(mockedFetch).toHaveBeenCalledTimes(2);
});

it('opens the paywall for a locked deep link sent back from a subject', async () => {
  mockResetAccess({ accessUntil: null });
  mockParams = { paywall: '1' };
  await renderList();
  expect(await screen.findByText('Mai târziu')).toBeTruthy();
  expect(router.setParams).toHaveBeenCalledWith({ paywall: undefined });
});
