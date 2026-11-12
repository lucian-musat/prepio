import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import WelcomeScreen from './WelcomeScreen';
import { signInWithGoogle } from '../../auth/google';
import { emailAuthEnabled } from '../../lib/flags';
import { fetchReferralPublicSettings, getPendingCode, lookupReferralCode, storePendingCode } from '../../lib/referrals';

// Welcome with the real invite-code field: a code typed and submitted at once (before the field's lookup debounce)
// must still reach storage for the sign-in that follows.
jest.mock('../../lib/referrals', () => ({
  ...jest.requireActual('../../lib/referrals'),
  fetchReferralPublicSettings: jest.fn(),
  getPendingCode: jest.fn(),
  lookupReferralCode: jest.fn(),
  storePendingCode: jest.fn(),
  clearPendingCode: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../../auth/google', () => ({ signInWithGoogle: jest.fn() }));
jest.mock('../../lib/flags', () => ({ emailAuthEnabled: jest.fn() }));
jest.mock('../../lib/termsConsent', () => ({
  getStoredConsent: jest.fn().mockResolvedValue(null),
  storeConsent: jest.fn().mockResolvedValue(undefined),
  clearConsent: jest.fn().mockResolvedValue(undefined),
}));

const CONSENT =
  'Am cel puțin 14 ani și accept Termenii de utilizare și Politica de confidențialitate. Dacă am sub 18 ani, am acordul părintelui sau al tutorelui pentru a folosi Prepio și pentru plăți.';
const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

beforeEach(() => {
  jest.clearAllMocks();
  (emailAuthEnabled as jest.Mock).mockReturnValue(true);
  (fetchReferralPublicSettings as jest.Mock).mockResolvedValue({
    enabled: true, threshold: 5, creditsPerInvitee: 40, durationMonths: 3, maxRewarded: 100, bonusCredits: 100,
  });
  (getPendingCode as jest.Mock).mockResolvedValue(null);
  (lookupReferralCode as jest.Mock).mockReturnValue(new Promise(() => {})); // the check never comes back in time
  (storePendingCode as jest.Mock).mockResolvedValue(undefined);
  (signInWithGoogle as jest.Mock).mockResolvedValue('ok');
});

const typeCodeAndConsent = async () => {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <WelcomeScreen />
    </SafeAreaProvider>,
  );
  await fireEvent.press(await screen.findByText('Ai un cod de invitație?'));
  await fireEvent.changeText(screen.getByLabelText('Cod de invitație'), 'abcd-2345');
  await fireEvent.press(screen.getByRole('checkbox', { name: CONSENT }));
};

it('Google right after typing a code (before the debounce) stores the code first', async () => {
  await typeCodeAndConsent();
  await fireEvent.press(screen.getByRole('button', { name: 'Continuă cu Google' }));
  expect(lookupReferralCode).not.toHaveBeenCalled();
  expect(storePendingCode).toHaveBeenCalledWith('ABCD2345');
  expect((storePendingCode as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
    (signInWithGoogle as jest.Mock).mock.invocationCallOrder[0],
  );
});

it('e-mail right after typing a code (before the debounce) stores the code', async () => {
  await typeCodeAndConsent();
  await fireEvent.press(screen.getByRole('button', { name: 'Continuă cu email' }));
  expect(lookupReferralCode).not.toHaveBeenCalled();
  expect(storePendingCode).toHaveBeenCalledWith('ABCD2345');
  expect(router.push).toHaveBeenCalledWith('/email');
});
