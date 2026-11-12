import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { extendAccessUntil, formatAccessDate } from '@prepio/shared';
import { AccessApiError, purchaseAccess } from '../lib/access';
import { PAYMENT_FOOTNOTE } from '../credits/PackagePicker';
import PaywallSheet from './PaywallSheet';

jest.mock('../lib/access', () => ({ ...jest.requireActual('../lib/access'), purchaseAccess: jest.fn() }));
jest.mock('../credits/CreditsProvider');
jest.mock('./AccessProvider');
const { mockResetCredits, setBalance, mockBalance } = jest.requireMock<typeof import('../credits/__mocks__/CreditsProvider')>('../credits/CreditsProvider');
const { mockResetAccess, applyPurchase } = jest.requireMock<typeof import('./__mocks__/AccessProvider')>('./AccessProvider');
const mockedPurchase = purchaseAccess as jest.Mock;

const DAY = 86400000;
const UNTIL = new Date(Date.now() + 90 * DAY).toISOString();
const OK = { orderId: 'o1', accessUntil: UNTIL, bonus: 100, balance: 112 };
const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

beforeEach(() => {
  jest.clearAllMocks();
  mockResetCredits(12);
  mockResetAccess();
});

const mount = async (props: Partial<Parameters<typeof PaywallSheet>[0]> = {}) => {
  const onClose = jest.fn();
  const onUnlocked = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <PaywallSheet visible lessonTitle="Unirea Principatelor" lessonCount={24} onClose={onClose} onUnlocked={onUnlocked} {...props} />
    </SafeAreaProvider>,
  );
  return { onClose, onUnlocked };
};
const unlock = () => screen.getByRole('button', { name: 'Deblochează · 150 lei' });

it('shows the offer from useAccess with the copy of the mockup', async () => {
  await mount();
  const end = formatAccessDate(extendAccessUntil(null, 3, new Date()));
  expect(screen.getByText('Deblochează toate lecțiile')).toBeTruthy();
  expect(screen.getByText('„Unirea Principatelor” face parte din accesul complet.')).toBeTruthy();
  expect(screen.getByText('📚 Toate cele 24 de lecții, în orice mod de învățare')).toBeTruthy();
  expect(screen.getByText('🪙 +100 de credite pentru profesorul digital')).toBeTruthy();
  expect(screen.getByText(`📅 Acces 3 luni, până la ${end}`)).toBeTruthy();
  expect(screen.getByText('🎁 Îți păstrezi creditele pe care le ai deja')).toBeTruthy();
  expect(screen.getByText('150 lei')).toBeTruthy();
  expect(screen.getByText('plată unică · nu se reînnoiește automat')).toBeTruthy();
  expect(unlock()).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Mai târziu' })).toBeTruthy();
  expect(screen.getByText(PAYMENT_FOOTNOTE)).toBeTruthy();
});

it('without a lesson or a count: no lesson line, „Toate lecțiile”', async () => {
  await mount({ lessonTitle: undefined, lessonCount: undefined });
  expect(screen.queryByText(/face parte din accesul complet/)).toBeNull();
  expect(screen.getByText('📚 Toate lecțiile, în orice mod de învățare')).toBeTruthy();
});

it('expired: „Reînnoiește accesul”, the end date counts from today', async () => {
  const past = new Date(Date.now() - 5 * DAY).toISOString();
  mockResetAccess({ accessUntil: past });
  await mount();
  expect(screen.getByText('Reînnoiește accesul')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Reînnoiește · 150 lei' })).toBeTruthy();
  expect(screen.getByText(`📅 Acces 3 luni, până la ${formatAccessDate(extendAccessUntil(past, 3, new Date()))}`)).toBeTruthy();
});

it('expiring: the new months are added after the current end', async () => {
  const soon = new Date(Date.now() + 4 * DAY).toISOString();
  mockResetAccess({ accessUntil: soon });
  await mount();
  expect(screen.getByText(`📅 Acces 3 luni, până la ${formatAccessDate(extendAccessUntil(soon, 3, new Date()))}`)).toBeTruthy();
});

it('no bonus: no credits line', async () => {
  mockResetAccess({ offer: { priceBani: 15000, bonusCredits: 0, durationMonths: 1 } });
  await mount();
  expect(screen.queryByText(/pentru profesorul digital/)).toBeNull();
  expect(screen.getByText(/^📅 Acces 1 lună, până la /)).toBeTruthy();
});

it('a double tap sends one purchase; the button is disabled while it runs', async () => {
  let resolve!: (v: typeof OK) => void;
  mockedPurchase.mockReturnValue(new Promise((r) => (resolve = r)));
  await mount();
  const button = unlock(); // the same element twice: a second tap before any re-render
  await fireEvent.press(button);
  await fireEvent.press(button);
  expect(mockedPurchase).toHaveBeenCalledTimes(1);
  expect(unlock().props.accessibilityState).toMatchObject({ disabled: true });
  await act(async () => resolve(OK));
});

it('success: applies the plan and the credits, confirms, then opens the lesson', async () => {
  mockedPurchase.mockResolvedValue(OK);
  const { onUnlocked } = await mount();
  await fireEvent.press(unlock());
  expect(applyPurchase).toHaveBeenCalledWith(OK);
  expect(setBalance).toHaveBeenCalledWith(112);
  expect(mockBalance()).toBe(112);
  expect(screen.getByText('Ai acces complet!')).toBeTruthy();
  expect(onUnlocked).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Deschide lecția' }));
  expect(onUnlocked).toHaveBeenCalledTimes(1);
});

it('guided order keeps the tapped lesson locked: „Înapoi la lecții” + hint, pressing only closes', async () => {
  mockedPurchase.mockResolvedValue(OK);
  const { onClose, onUnlocked } = await mount({ canOpenAfterPurchase: false });
  await fireEvent.press(unlock());
  expect(screen.getByText('Ai acces complet!')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Deschide lecția' })).toBeNull();
  expect(screen.getByText('Lecțiile se deschid în ordine, pe traseul ghidat.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Înapoi la lecții' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onUnlocked).not.toHaveBeenCalled();
});

it('openable after the purchase (default): „Deschide lecția” and no hint', async () => {
  mockedPurchase.mockResolvedValue(OK);
  await mount();
  await fireEvent.press(unlock());
  expect(screen.queryByText('Lecțiile se deschid în ordine, pe traseul ghidat.')).toBeNull();
  expect(screen.getByRole('button', { name: 'Deschide lecția' })).toBeTruthy();
});

it('offer_changed: shows the new offer and the message, and stays open', async () => {
  const fresh = { priceBani: 20000, bonusCredits: 50, durationMonths: 6 };
  mockedPurchase.mockRejectedValueOnce(new AccessApiError('offer_changed', 'x', fresh));
  const { onClose, onUnlocked } = await mount();
  await fireEvent.press(unlock());
  expect(screen.getByText('Oferta s-a schimbat. Verifică noul preț.')).toBeTruthy();
  expect(screen.getByText('200 lei')).toBeTruthy();
  expect(screen.getByText('🪙 +50 de credite pentru profesorul digital')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Deblochează · 200 lei' })).toBeTruthy();
  expect(onClose).not.toHaveBeenCalled();
  expect(onUnlocked).not.toHaveBeenCalled();
  mockedPurchase.mockResolvedValueOnce(OK);
  await fireEvent.press(screen.getByRole('button', { name: 'Deblochează · 200 lei' }));
  expect(mockedPurchase).toHaveBeenLastCalledWith(fresh);
});

it('a failure shows its message; „Mai târziu” closes', async () => {
  mockedPurchase.mockRejectedValue(new AccessApiError('server_error', 'Cumpărarea nu a reușit. Încearcă din nou.'));
  const { onClose } = await mount();
  await fireEvent.press(unlock());
  expect(screen.getByText('Cumpărarea nu a reușit. Încearcă din nou.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Mai târziu' }));
  expect(onClose).toHaveBeenCalled();
});

it('renders nothing when not visible', async () => {
  await mount({ visible: false });
  expect(screen.queryByTestId('paywall-sheet')).toBeNull();
});
