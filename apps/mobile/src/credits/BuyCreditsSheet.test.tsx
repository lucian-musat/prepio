import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CreditsApiError, fetchCreditPackages, purchaseCredits } from '../lib/credits';
import BuyCreditsSheet from './BuyCreditsSheet';

jest.mock('./CreditsProvider');
const { mockBalance, mockResetCredits } = jest.requireMock<typeof import('./__mocks__/CreditsProvider')>('./CreditsProvider');
jest.mock('../lib/credits', () => ({
  ...jest.requireActual('../lib/credits'),
  fetchCreditPackages: jest.fn(),
  purchaseCredits: jest.fn(),
}));
const mockedPackages = fetchCreditPackages as jest.Mock;
const mockedPurchase = purchaseCredits as jest.Mock;

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const PACKAGES = [
  { id: 'p20', credits: 20, priceBani: 999, featured: false },
  { id: 'p50', credits: 50, priceBani: 1999, featured: true },
  { id: 'p120', credits: 120, priceBani: 3999, featured: false },
];

const handlers = () => ({ onClose: jest.fn(), onSkip: jest.fn(), onCheckNow: jest.fn() });
async function mount(h = handlers()) {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <BuyCreditsSheet visible required={2} cost={2} {...h} />
    </SafeAreaProvider>,
  );
  return h;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockResetCredits(1);
  mockedPackages.mockResolvedValue(PACKAGES);
});

it('choose: says how many credits are missing, lists the packages with the featured one preselected', async () => {
  await mount();
  expect(screen.getByText('Îți mai trebuie 1 credit')).toBeTruthy();
  expect(await screen.findByText('CEL MAI POPULAR')).toBeTruthy();
  expect(screen.getByText('0,40 lei / credit')).toBeTruthy();
  expect(screen.getByRole('radio', { name: /^50 de credite, 19,99 lei/ })).toBeChecked();
  expect(screen.getByRole('radio', { name: /^20 de credite, 9,99 lei/ })).not.toBeChecked();
  expect(screen.getByRole('button', { name: 'Cumpără 50 de credite · 19,99 lei' })).toBeEnabled();
  expect(screen.getByText('Plata nu e încă activă — cererea a fost aprobată automat.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('radio', { name: /^20 de credite/ }));
  expect(screen.getByRole('button', { name: 'Cumpără 20 de credite · 9,99 lei' })).toBeTruthy();
});

it('buying a package: the balance updates, then „Verifică acum” runs the check', async () => {
  mockedPurchase.mockResolvedValue({ orderId: 'o1', credits: 50, balance: 51 });
  const h = await mount();
  await act(async () => void fireEvent.press(await screen.findByRole('button', { name: 'Cumpără 50 de credite · 19,99 lei' })));
  expect(mockedPurchase).toHaveBeenCalledWith('p50');
  expect(mockBalance()).toBe(51);
  expect(screen.getByText('+50')).toBeTruthy();
  expect(screen.getByText('Credite adăugate!')).toBeTruthy();
  expect(screen.getByText('Acum ai 51 de credite.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Verifică acum, costă 2 credite' }));
  expect(h.onCheckNow).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Înapoi la exercițiu' }));
  expect(h.onClose).toHaveBeenCalled();
});

it('a second press while the purchase is in flight is ignored', async () => {
  let resolve!: (v: unknown) => void;
  mockedPurchase.mockReturnValue(new Promise((r) => (resolve = r)));
  await mount();
  const buy = await screen.findByRole('button', { name: 'Cumpără 50 de credite · 19,99 lei' });
  await act(async () => void fireEvent.press(buy));
  await act(async () => void fireEvent.press(buy));
  expect(mockedPurchase).toHaveBeenCalledTimes(1);
  await act(async () => resolve({ orderId: 'o1', credits: 50, balance: 51 }));
});

it('a package that still leaves the balance short: no „Verifică acum”, the packages again with what is still missing', async () => {
  mockResetCredits(1);
  mockedPurchase.mockResolvedValue({ orderId: 'o1', credits: 20, balance: 21 });
  const h = handlers();
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <BuyCreditsSheet visible required={30} cost={30} {...h} />
    </SafeAreaProvider>,
  );
  expect(screen.getByText('Îți mai trebuie 29 de credite')).toBeTruthy();
  await fireEvent.press(await screen.findByRole('radio', { name: /^20 de credite/ }));
  await act(async () => void fireEvent.press(screen.getByRole('button', { name: 'Cumpără 20 de credite · 9,99 lei' })));
  expect(mockBalance()).toBe(21);
  expect(screen.queryByText('Credite adăugate!')).toBeNull();
  expect(screen.queryByRole('button', { name: /^Verifică acum/ })).toBeNull();
  expect(screen.getByText('Îți mai trebuie 9 credite')).toBeTruthy();
  expect(screen.getByRole('button', { name: /^Cumpără/ })).toBeEnabled();
  mockedPurchase.mockResolvedValue({ orderId: 'o2', credits: 50, balance: 71 });
  await fireEvent.press(screen.getByRole('radio', { name: /^50 de credite/ }));
  await act(async () => void fireEvent.press(screen.getByRole('button', { name: 'Cumpără 50 de credite · 19,99 lei' })));
  expect(screen.getByText('Credite adăugate!')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Verifică acum, costă 30 de credite' }));
  expect(h.onCheckNow).toHaveBeenCalledTimes(1);
});

it('skipDisabled: „Sari peste exercițiu” is disabled and does not skip', async () => {
  const h = handlers();
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <BuyCreditsSheet visible required={2} cost={2} skipDisabled {...h} />
    </SafeAreaProvider>,
  );
  expect(screen.getByRole('button', { name: 'Sari peste exercițiu' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Sari peste exercițiu' }));
  expect(h.onSkip).not.toHaveBeenCalled();
});

it('„Sari peste exercițiu” skips', async () => {
  const h = await mount();
  await fireEvent.press(screen.getByRole('button', { name: 'Sari peste exercițiu' }));
  expect(h.onSkip).toHaveBeenCalledTimes(1);
});

it('a package that is no longer available: the message, and the packages are fetched again', async () => {
  mockedPurchase.mockRejectedValue(new CreditsApiError('package_unavailable', 'Pachetul nu mai este disponibil. Alege altul.'));
  await mount();
  await act(async () => void fireEvent.press(await screen.findByRole('button', { name: 'Cumpără 50 de credite · 19,99 lei' })));
  expect(screen.getByText('Pachetul nu mai este disponibil. Alege altul.')).toBeTruthy();
  expect(mockedPackages).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('button', { name: /^Cumpără/ })).toBeEnabled();
});

it('another purchase error: the message, and the same button retries', async () => {
  mockedPurchase
    .mockRejectedValueOnce(new CreditsApiError('server_error', 'Achiziția nu a reușit. Încearcă din nou.'))
    .mockResolvedValueOnce({ orderId: 'o1', credits: 50, balance: 51 });
  await mount();
  const buy = () => screen.getByRole('button', { name: 'Cumpără 50 de credite · 19,99 lei' });
  await screen.findByText('CEL MAI POPULAR');
  await act(async () => void fireEvent.press(buy()));
  expect(screen.getByText('Achiziția nu a reușit. Încearcă din nou.')).toBeTruthy();
  await act(async () => void fireEvent.press(buy()));
  expect(screen.getByText('Credite adăugate!')).toBeTruthy();
});

it('packages that fail to load: the message with „Reîncearcă”, skip still there', async () => {
  mockedPackages.mockRejectedValueOnce(new Error('offline'));
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const h = await mount();
  expect(await screen.findByText('Nu am putut încărca pachetele.')).toBeTruthy();
  expect(warn).toHaveBeenCalled();
  warn.mockRestore();
  await fireEvent.press(screen.getByRole('button', { name: 'Sari peste exercițiu' }));
  expect(h.onSkip).toHaveBeenCalled();
  await act(async () => void fireEvent.press(screen.getByRole('button', { name: 'Reîncearcă' })));
  expect(await screen.findByText('CEL MAI POPULAR')).toBeTruthy();
});
