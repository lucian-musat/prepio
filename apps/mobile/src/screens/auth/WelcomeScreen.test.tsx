import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import WelcomeScreen from './WelcomeScreen';
import { signInWithGoogle } from '../../auth/google';
import { emailAuthEnabled } from '../../lib/flags';
import { clearConsent, getStoredConsent, storeConsent } from '../../lib/termsConsent';
import { TERMS_VERSION } from '../../lib/legal';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../../auth/google', () => ({ signInWithGoogle: jest.fn() }));
jest.mock('../../lib/flags', () => ({ emailAuthEnabled: jest.fn() }));
jest.mock('../../lib/termsConsent', () => ({
  getStoredConsent: jest.fn(),
  storeConsent: jest.fn(),
  clearConsent: jest.fn(),
}));

const CONSENT = 'Am cel puțin 16 ani și accept Termenii de utilizare și Politica de confidențialitate.';

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const renderWelcome = async () =>
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <WelcomeScreen />
    </SafeAreaProvider>,
  );

const google = () => screen.getByRole('button', { name: 'Continuă cu Google' });
const consent = () => screen.getByRole('checkbox', { name: CONSENT });
const tick = () => fireEvent.press(consent());

beforeEach(() => {
  jest.clearAllMocks();
  (emailAuthEnabled as jest.Mock).mockReturnValue(false);
  (getStoredConsent as jest.Mock).mockResolvedValue(null);
  (storeConsent as jest.Mock).mockResolvedValue(undefined);
  (clearConsent as jest.Mock).mockResolvedValue(undefined);
});

it('shows the copy, the Google button and the consent checkbox (unchecked)', async () => {
  await renderWelcome();
  expect(screen.getByText('Bun venit la Prepio')).toBeTruthy();
  expect(google()).toBeTruthy();
  expect(consent().props.accessibilityState).toMatchObject({ checked: false });
  // The checkbox replaces the old footer sentence.
  expect(screen.queryByText(/Continuând, ești de acord/)).toBeNull();
});

it('keeps „Continuă cu Google” disabled until the consent is checked', async () => {
  await renderWelcome();
  expect(google().props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(google());
  expect(signInWithGoogle).not.toHaveBeenCalled();
  await tick();
  expect(consent().props.accessibilityState).toMatchObject({ checked: true });
  expect(google().props.accessibilityState.disabled).toBe(false);
});

it('checking stores the consent for the current terms version; unchecking clears it', async () => {
  await renderWelcome();
  await tick();
  expect(storeConsent).toHaveBeenCalledWith(TERMS_VERSION);
  await tick();
  expect(clearConsent).toHaveBeenCalledTimes(1);
  expect(google().props.accessibilityState.disabled).toBe(true);
});

it('starts checked when this device already stored the consent (back from the web OAuth redirect)', async () => {
  (getStoredConsent as jest.Mock).mockResolvedValue(TERMS_VERSION);
  await renderWelcome();
  expect(await screen.findByRole('checkbox', { name: CONSENT, checked: true })).toBeTruthy();
  expect(google().props.accessibilityState.disabled).toBe(false);
});

it('ignores a consent stored for an older terms version', async () => {
  (getStoredConsent as jest.Mock).mockResolvedValue('2020-01-01');
  await renderWelcome();
  await act(async () => {});
  expect(consent().props.accessibilityState).toMatchObject({ checked: false });
});

it('the two links open the terms and the privacy policy', async () => {
  await renderWelcome();
  await fireEvent.press(screen.getByText('Termenii de utilizare'));
  expect(router.push).toHaveBeenCalledWith('/termeni');
  await fireEvent.press(screen.getByText('Politica de confidențialitate'));
  expect(router.push).toHaveBeenCalledWith('/confidentialitate');
  // A link tap does not toggle the checkbox.
  expect(storeConsent).not.toHaveBeenCalled();
});

it('hides the email button when the flag is off', async () => {
  await renderWelcome();
  expect(screen.queryByText('Continuă cu email')).toBeNull();
});

it('gates the email button on the consent too, then opens the email screen', async () => {
  (emailAuthEnabled as jest.Mock).mockReturnValue(true);
  await renderWelcome();
  const email = () => screen.getByRole('button', { name: 'Continuă cu email' });
  expect(email().props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(email());
  expect(router.push).not.toHaveBeenCalled();
  await tick();
  await fireEvent.press(email());
  expect(router.push).toHaveBeenCalledWith('/email');
});

it('leaves no error text when the Google picker is cancelled', async () => {
  (signInWithGoogle as jest.Mock).mockResolvedValue('cancelled');
  await renderWelcome();
  await tick();
  await fireEvent.press(google());
  expect(signInWithGoogle).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('alert')).toBeNull();
  expect(google().props.accessibilityState.disabled).toBe(false);
});

it('shows the error message when Google sign-in fails', async () => {
  (signInWithGoogle as jest.Mock).mockRejectedValue(new Error('Nu am putut face autentificarea.'));
  await renderWelcome();
  await tick();
  await fireEvent.press(google());
  expect(await screen.findByText('Nu am putut face autentificarea.')).toBeTruthy();
});

it('disables the Google button while a sign-in is pending', async () => {
  let resolve!: (v: 'cancelled') => void;
  (signInWithGoogle as jest.Mock).mockReturnValue(new Promise((r) => (resolve = r)));
  await renderWelcome();
  await tick();
  await fireEvent.press(google());
  expect(google().props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(google());
  expect(signInWithGoogle).toHaveBeenCalledTimes(1);
  await act(async () => resolve('cancelled'));
});
