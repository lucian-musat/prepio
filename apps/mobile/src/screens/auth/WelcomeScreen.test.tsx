import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import WelcomeScreen from './WelcomeScreen';
import { signInWithGoogle } from '../../auth/google';
import { emailAuthEnabled } from '../../lib/flags';
import { clearConsent, getStoredConsent, storeConsent } from '../../lib/termsConsent';
import { TERMS_VERSION } from '../../lib/legal';
import { clearPendingCode, storePendingCode } from '../../lib/referrals';

jest.mock('../../lib/referrals', () => ({ storePendingCode: jest.fn(), clearPendingCode: jest.fn() }));
jest.mock('../../components/ReferralCodeField', () => {
  const { Pressable, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ onChange }: { onChange: (c: string | null) => void }) => (
      <Pressable accessibilityRole="button" accessibilityLabel="set-code" onPress={() => onChange('ABCD2345')}>
        <Text>field</Text>
      </Pressable>
    ),
  };
});

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../../auth/google', () => ({ signInWithGoogle: jest.fn() }));
jest.mock('../../lib/flags', () => ({ emailAuthEnabled: jest.fn() }));
jest.mock('../../lib/termsConsent', () => ({
  getStoredConsent: jest.fn(),
  storeConsent: jest.fn(),
  clearConsent: jest.fn(),
}));

const CONSENT =
  'Am cel puțin 14 ani și accept Termenii de utilizare și Politica de confidențialitate. Dacă am sub 18 ani, am acordul părintelui sau al tutorelui pentru a folosi Prepio și pentru plăți.';

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
  (storePendingCode as jest.Mock).mockResolvedValue(undefined);
  (clearPendingCode as jest.Mock).mockResolvedValue(undefined);
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

it('the two links sit outside the checkbox and open the terms and the privacy policy', async () => {
  await renderWelcome();
  // The checkbox holds only the box and the plain sentence: no link inside it.
  expect(within(consent()).queryAllByRole('link')).toHaveLength(0);
  expect(within(consent()).getByText(CONSENT)).toBeTruthy();
  const terms = screen.getByRole('link', { name: 'Termenii de utilizare' });
  const privacy = screen.getByRole('link', { name: 'Politica de confidențialitate' });
  expect(within(consent()).queryByText('Termenii de utilizare')).toBeNull();
  expect(within(consent()).queryByText('Politica de confidențialitate')).toBeNull();
  await fireEvent.press(terms);
  expect(router.push).toHaveBeenCalledWith('/termeni');
  await fireEvent.press(privacy);
  expect(router.push).toHaveBeenCalledWith('/confidentialitate');
  expect(storeConsent).not.toHaveBeenCalled();
  expect(consent().props.accessibilityState).toMatchObject({ checked: false });
});

it('stores the invite code before starting Google', async () => {
  (signInWithGoogle as jest.Mock).mockResolvedValue('ok');
  await renderWelcome();
  await fireEvent.press(screen.getByRole('button', { name: 'set-code' }));
  await tick();
  await fireEvent.press(google());
  expect(storePendingCode).toHaveBeenCalledWith('ABCD2345');
  expect((storePendingCode as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
    (signInWithGoogle as jest.Mock).mock.invocationCallOrder[0],
  );
});

it('stores the invite code before opening the email screen', async () => {
  (emailAuthEnabled as jest.Mock).mockReturnValue(true);
  await renderWelcome();
  await fireEvent.press(screen.getByRole('button', { name: 'set-code' }));
  await tick();
  await fireEvent.press(screen.getByRole('button', { name: 'Continuă cu email' }));
  expect(storePendingCode).toHaveBeenCalledWith('ABCD2345');
});

it('stores no invite code when none was entered', async () => {
  (signInWithGoogle as jest.Mock).mockResolvedValue('ok');
  await renderWelcome();
  await tick();
  await fireEvent.press(google());
  expect(storePendingCode).not.toHaveBeenCalled();
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

it('a cancelled Google sign-in clears the stored consent; the next press stores it again', async () => {
  (signInWithGoogle as jest.Mock).mockResolvedValue('cancelled');
  await renderWelcome();
  await tick();
  (storeConsent as jest.Mock).mockClear();
  await fireEvent.press(google());
  expect(storeConsent).toHaveBeenCalledWith(TERMS_VERSION);
  expect(clearConsent).toHaveBeenCalledTimes(1);
  expect((clearConsent as jest.Mock).mock.invocationCallOrder[0]).toBeGreaterThan(
    (signInWithGoogle as jest.Mock).mock.invocationCallOrder[0],
  );
  await fireEvent.press(google());
  expect(storeConsent).toHaveBeenCalledTimes(2);
});

it('a failed Google sign-in clears the stored consent', async () => {
  (signInWithGoogle as jest.Mock).mockRejectedValue(new Error('Nu am putut face autentificarea.'));
  await renderWelcome();
  await tick();
  await fireEvent.press(google());
  expect(clearConsent).toHaveBeenCalledTimes(1);
});

it('a cancelled or failed Google sign-in clears the pending invite code; the next press stores it again', async () => {
  (signInWithGoogle as jest.Mock).mockResolvedValue('cancelled');
  await renderWelcome();
  await fireEvent.press(screen.getByRole('button', { name: 'set-code' }));
  await tick();
  await fireEvent.press(google());
  expect(clearPendingCode).toHaveBeenCalledTimes(1);
  expect((clearPendingCode as jest.Mock).mock.invocationCallOrder[0]).toBeGreaterThan(
    (signInWithGoogle as jest.Mock).mock.invocationCallOrder[0],
  );
  (signInWithGoogle as jest.Mock).mockRejectedValue(new Error('x'));
  await fireEvent.press(google());
  expect(storePendingCode).toHaveBeenCalledTimes(2);
  expect(clearPendingCode).toHaveBeenCalledTimes(2);
});

it('a Google sign-in that goes ahead keeps the pending invite code', async () => {
  (signInWithGoogle as jest.Mock).mockResolvedValue('ok');
  await renderWelcome();
  await fireEvent.press(screen.getByRole('button', { name: 'set-code' }));
  await tick();
  await fireEvent.press(google());
  expect(clearPendingCode).not.toHaveBeenCalled();
});

it('a Google sign-in that goes ahead keeps the stored consent (AuthProvider records it)', async () => {
  (signInWithGoogle as jest.Mock).mockResolvedValue('ok');
  await renderWelcome();
  await tick();
  await fireEvent.press(google());
  expect(clearConsent).not.toHaveBeenCalled();
});

describe('pre-tick from the real stored consent', () => {
  const actual = jest.requireActual('../../lib/termsConsent');
  beforeEach(async () => {
    await AsyncStorage.clear();
    (getStoredConsent as jest.Mock).mockImplementation(actual.getStoredConsent);
    (storeConsent as jest.Mock).mockImplementation(actual.storeConsent);
    (clearConsent as jest.Mock).mockImplementation(actual.clearConsent);
  });

  it('a fresh consent pre-ticks the box', async () => {
    await actual.storeConsent(TERMS_VERSION);
    await renderWelcome();
    expect(await screen.findByRole('checkbox', { name: CONSENT, checked: true })).toBeTruthy();
  });

  it('a stale consent does not pre-tick the box and is removed', async () => {
    await AsyncStorage.setItem(actual.TERMS_CONSENT_KEY, JSON.stringify({ version: TERMS_VERSION, at: Date.now() - actual.CONSENT_TTL_MS - 1 }));
    await renderWelcome();
    await act(async () => {});
    expect(consent().props.accessibilityState).toMatchObject({ checked: false });
    expect(await AsyncStorage.getItem(actual.TERMS_CONSENT_KEY)).toBeNull();
  });
});

it('the sign-in buttons carry the hint to tick the consent only while they are disabled for it', async () => {
  (emailAuthEnabled as jest.Mock).mockReturnValue(true);
  await renderWelcome();
  const email = () => screen.getByRole('button', { name: 'Continuă cu email' });
  expect(google().props.accessibilityHint).toBe('Bifează confirmarea de mai sus.');
  expect(email().props.accessibilityHint).toBe('Bifează confirmarea de mai sus.');
  await tick();
  expect(google().props.accessibilityHint).toBeUndefined();
  expect(email().props.accessibilityHint).toBeUndefined();
});
