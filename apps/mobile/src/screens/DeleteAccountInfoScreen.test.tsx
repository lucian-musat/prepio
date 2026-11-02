import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import DeleteAccountInfoScreen from './DeleteAccountInfoScreen';
import { CONTACT_EMAIL } from '../lib/legal';
import { getSupabase } from '../lib/supabase';
import type { AuthStatus } from '../auth/AuthProvider';

let mockStatus: AuthStatus = 'signedOut';
jest.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ status: mockStatus, session: null, profile: null, refreshProfile: jest.fn(), signOut: jest.fn() }),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true } }));

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const renderScreen = async () =>
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <DeleteAccountInfoScreen />
    </SafeAreaProvider>,
  );

const SIGN_IN_HINT = 'După ce intri, mergi la Profil → Șterge contul.';

beforeEach(() => {
  jest.clearAllMocks();
  mockStatus = 'signedOut';
});

it('renders without querying Supabase and shows the contact address', async () => {
  mockStatus = 'signedOut';
  await renderScreen();
  expect(screen.getByText('Ștergerea contului')).toBeTruthy();
  expect(screen.getByText(`Sau scrie-ne la ${CONTACT_EMAIL}.`)).toBeTruthy();
  expect(getSupabase).not.toHaveBeenCalled();
});

it('signed out: offers sign-in (to the welcome screen) and explains where deletion is', async () => {
  mockStatus = 'signedOut';
  await renderScreen();
  expect(screen.getByText(SIGN_IN_HINT)).toBeTruthy();
  expect(screen.queryByText('Mergi la profil')).toBeNull();
  fireEvent.press(screen.getByText('Intră în cont'));
  expect(router.push).toHaveBeenCalledWith('/');
});

it('signed in (ready): offers the profile, where the account is deleted', async () => {
  mockStatus = 'ready';
  await renderScreen();
  expect(screen.queryByText('Intră în cont')).toBeNull();
  expect(screen.queryByText(SIGN_IN_HINT)).toBeNull();
  expect(screen.getByText(`Sau scrie-ne la ${CONTACT_EMAIL}.`)).toBeTruthy();
  fireEvent.press(screen.getByText('Mergi la profil'));
  expect(router.push).toHaveBeenCalledWith('/profile');
});
