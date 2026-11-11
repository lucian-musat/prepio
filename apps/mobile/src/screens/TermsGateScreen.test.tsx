import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import TermsGateScreen from './TermsGateScreen';
import { acceptTerms, clearConsent, TermsAcceptError } from '../lib/termsConsent';
import { CONTACT_EMAIL, TERMS_VERSION } from '../lib/legal';

const mockRefresh = jest.fn();
const mockSignOut = jest.fn();
jest.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ refreshProfile: mockRefresh, signOut: mockSignOut }),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../lib/termsConsent', () => ({
  ...jest.requireActual('../lib/termsConsent'),
  acceptTerms: jest.fn(),
  clearConsent: jest.fn(),
}));

const CONSENT =
  'Am cel puțin 14 ani și accept Termenii de utilizare și Politica de confidențialitate. Dacă am sub 18 ani, am acordul părintelui sau tutorelui pentru a folosi Prepio și pentru plăți.';
const SAVE_FAILED = 'Nu am putut salva. Încearcă din nou.';

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const renderGate = async () =>
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <TermsGateScreen />
    </SafeAreaProvider>,
  );

const cont = () => screen.getByRole('button', { name: 'Continuă' });

beforeEach(() => {
  jest.clearAllMocks();
  (acceptTerms as jest.Mock).mockResolvedValue(undefined);
  (clearConsent as jest.Mock).mockResolvedValue(undefined);
  mockRefresh.mockResolvedValue({ id: 'u1', termsVersion: TERMS_VERSION });
  mockSignOut.mockResolvedValue(undefined);
});

it('„Continuă” is disabled until the consent is checked', async () => {
  await renderGate();
  expect(screen.getByRole('checkbox', { name: CONSENT }).props.accessibilityState).toMatchObject({ checked: false });
  expect(cont().props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(cont());
  expect(acceptTerms).not.toHaveBeenCalled();
});

it('once checked, „Continuă” accepts the terms and refreshes the profile', async () => {
  await renderGate();
  await fireEvent.press(screen.getByRole('checkbox', { name: CONSENT }));
  expect(cont().props.accessibilityState.disabled).toBe(false);
  await fireEvent.press(cont());
  expect(acceptTerms).toHaveBeenCalledTimes(1);
  expect(clearConsent).toHaveBeenCalledTimes(1);
  expect(mockRefresh).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('alert')).toBeNull();
});

it('any other RPC error shows the generic save error and does not refresh', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  (acceptTerms as jest.Mock).mockRejectedValue(new Error('connection failure'));
  await renderGate();
  await fireEvent.press(screen.getByRole('checkbox', { name: CONSENT }));
  await fireEvent.press(cont());
  expect(await screen.findByRole('alert')).toHaveTextContent(SAVE_FAILED);
  expect(mockRefresh).not.toHaveBeenCalled();
  expect(clearConsent).not.toHaveBeenCalled();
  warn.mockRestore();
});

it('a refreshed profile still without the current terms shows the save error', async () => {
  mockRefresh.mockResolvedValue({ id: 'u1', termsVersion: null });
  await renderGate();
  await fireEvent.press(screen.getByRole('checkbox', { name: CONSENT }));
  await fireEvent.press(cont());
  expect(await screen.findByRole('alert')).toHaveTextContent(SAVE_FAILED);
});

it('„Ieși din cont” signs out', async () => {
  await renderGate();
  await fireEvent.press(screen.getByText('Ieși din cont'));
  expect(mockSignOut).toHaveBeenCalledTimes(1);
});

it('the links sit outside the checkbox and open the terms and the privacy policy', async () => {
  await renderGate();
  expect(within(screen.getByRole('checkbox', { name: CONSENT })).queryAllByRole('link')).toHaveLength(0);
  await fireEvent.press(screen.getByRole('link', { name: 'Termenii de utilizare' }));
  expect(router.push).toHaveBeenCalledWith('/termeni');
  await fireEvent.press(screen.getByRole('link', { name: 'Politica de confidențialitate' }));
  expect(router.push).toHaveBeenCalledWith('/confidentialitate');
});

it('a terms version mismatch asks to update the app instead of retrying', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  (acceptTerms as jest.Mock).mockRejectedValue(new TermsAcceptError('terms_version_mismatch', 'terms_version_mismatch'));
  await renderGate();
  await fireEvent.press(screen.getByRole('checkbox', { name: CONSENT }));
  await fireEvent.press(cont());
  expect(await screen.findByRole('alert')).toHaveTextContent(
    `Actualizează aplicația (sau reîncarcă pagina) ca să continui. Dacă problema rămâne, scrie-ne la ${CONTACT_EMAIL}.`,
  );
  expect(screen.queryByText(SAVE_FAILED)).toBeNull();
  expect(mockRefresh).not.toHaveBeenCalled();
  warn.mockRestore();
});

it('„Continuă” carries the hint to tick the consent only while it is disabled for it', async () => {
  await renderGate();
  expect(cont().props.accessibilityHint).toBe('Bifează confirmarea de mai sus.');
  await fireEvent.press(screen.getByRole('checkbox', { name: CONSENT }));
  expect(cont().props.accessibilityHint).toBeUndefined();
});

it('says the app is for high-school students aged 14 or more', async () => {
  await renderGate();
  expect(screen.getByText(/elevii de liceu care au cel puțin 14 ani/)).toBeTruthy();
});
