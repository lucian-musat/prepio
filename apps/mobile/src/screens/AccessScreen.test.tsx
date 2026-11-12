import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { formatAccessDate } from '@prepio/shared';
import { fetchAccessHistory, purchaseAccess, type AccessHistoryEntry } from '../lib/access';
import AccessScreen from './AccessScreen';

jest.mock('../lib/access', () => ({ ...jest.requireActual('../lib/access'), purchaseAccess: jest.fn(), fetchAccessHistory: jest.fn() }));
jest.mock('../credits/CreditsProvider');
jest.mock('../access/AccessProvider');
jest.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true } }));
const { mockResetCredits } = jest.requireMock<typeof import('../credits/__mocks__/CreditsProvider')>('../credits/CreditsProvider');
const { mockResetAccess, refresh } = jest.requireMock<typeof import('../access/__mocks__/AccessProvider')>('../access/AccessProvider');
const mockedHistory = fetchAccessHistory as jest.Mock;
const mockedPurchase = purchaseAccess as jest.Mock;

const DAY = 86400000;
const inDays = (n: number) => new Date(Date.now() + n * DAY).toISOString();
const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const mount = async () =>
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AccessScreen />
    </SafeAreaProvider>,
  );
const hist = (over: Partial<AccessHistoryEntry>): AccessHistoryEntry => ({
  kind: 'purchase',
  months: 3,
  untilAfter: inDays(90),
  createdAt: '2026-11-08T10:00:00Z',
  priceBani: 15000,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockResetCredits(49);
  mockResetAccess();
  mockedHistory.mockResolvedValue([]);
});

it('shows the full-access card, progress, what is included and the extension', async () => {
  const until = inDays(34);
  mockResetAccess({ accessUntil: until });
  await mount();
  expect(screen.getByText('Acces la lecții')).toBeTruthy();
  expect(refresh).toHaveBeenCalled();
  expect(screen.getByText('★ Acces complet')).toBeTruthy();
  expect(screen.getByText(`Activ până la ${formatAccessDate(new Date(until))}`)).toBeTruthy();
  expect(screen.getByText('mai ai 34 de zile')).toBeTruthy();
  expect(screen.getByRole('progressbar')).toBeTruthy();
  expect(screen.getByText('Ce include')).toBeTruthy();
  expect(screen.getByText('Toate lecțiile · +100 de credite la fiecare plată · 3 luni')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Prelungește cu 3 luni · 150 lei' })).toBeTruthy();
  expect(screen.getByText(`Lunile noi se adaugă după ${formatAccessDate(new Date(until))}.`)).toBeTruthy();
});

it('trial: unlock button, no progress', async () => {
  await mount();
  expect(screen.getByRole('button', { name: 'Deblochează · 150 lei' })).toBeTruthy();
  expect(screen.queryByRole('progressbar')).toBeNull();
  expect(screen.queryByText(/Lunile noi/)).toBeNull();
});

it('expired: renew button', async () => {
  mockResetAccess({ accessUntil: inDays(-3) });
  await mount();
  expect(screen.getByRole('button', { name: 'Reînnoiește · 150 lei' })).toBeTruthy();
});

it('buys through the shared purchase hook and shows the new state', async () => {
  const until = inDays(90);
  mockedPurchase.mockResolvedValue({ orderId: 'o', accessUntil: until, bonus: 100, balance: 149 });
  await mount();
  fireEvent.press(screen.getByRole('button', { name: 'Deblochează · 150 lei' }));
  expect(await screen.findByText('★ Acces complet')).toBeTruthy();
  expect(await screen.findByText('Ai acces complet!')).toBeTruthy();
});

it('a failed purchase after a successful one does not keep the success message', async () => {
  mockedPurchase.mockResolvedValueOnce({ orderId: 'o', accessUntil: inDays(90), bonus: 100, balance: 149 });
  mockedPurchase.mockRejectedValueOnce(new Error('Nu merge.'));
  await mount();
  fireEvent.press(screen.getByRole('button', { name: 'Deblochează · 150 lei' }));
  expect(await screen.findByText('Ai acces complet!')).toBeTruthy();
  fireEvent.press(await screen.findByRole('button', { name: 'Prelungește cu 3 luni · 150 lei' }));
  expect(await screen.findByText('Nu merge.')).toBeTruthy();
  expect(screen.queryByText('Ai acces complet!')).toBeNull();
});

it('shows the purchase error', async () => {
  mockedPurchase.mockRejectedValue(new Error('Nu merge.'));
  await mount();
  fireEvent.press(screen.getByRole('button', { name: 'Deblochează · 150 lei' }));
  expect(await screen.findByText('Nu merge.')).toBeTruthy();
});

it('shows the balance and links to the credits screen', async () => {
  await mount();
  expect(screen.getByText('49 de credite')).toBeTruthy();
  fireEvent.press(screen.getByRole('link', { name: '49 de credite · Creditele mele' }));
  expect(router.push).toHaveBeenCalledWith('/credits');
});

it('lists the history without admin details', async () => {
  mockedHistory.mockResolvedValue([
    hist({}),
    hist({ kind: 'admin_grant', months: 2, priceBani: null }),
    hist({ kind: 'admin_revoke', months: null, priceBani: null }),
    hist({ kind: 'referral_reward', months: 3, priceBani: null }),
  ]);
  await mount();
  expect(mockedHistory).toHaveBeenCalledWith('u1');
  // Every row reads the same way: what happened, its date under it, the amount on the right.
  expect(await screen.findByText('Acces 3 luni')).toBeTruthy();
  expect(screen.getByText('150 lei')).toBeTruthy();
  expect(screen.getByText('Acces acordat')).toBeTruthy();
  expect(screen.getByText('Acces retras')).toBeTruthy();
  expect(screen.getByText('Acces gratuit din recomandări')).toBeTruthy();
  expect(screen.getAllByText('+3 luni')).toHaveLength(1);
  expect(screen.getByText('+2 luni')).toBeTruthy();
  expect(screen.queryByText('Recomandări')).toBeNull();
  expect(screen.getAllByText('8 noiembrie 2026')).toHaveLength(4);
  expect(screen.getByText('Istoric')).toBeTruthy();
});

it('hides the history when empty or failing', async () => {
  await mount();
  await screen.findByText('Ce include');
  expect(screen.queryByText('Istoric')).toBeNull();
});
