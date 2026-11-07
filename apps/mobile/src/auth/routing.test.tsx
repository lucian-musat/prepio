import { Text } from 'react-native';
import { renderRouter, screen } from 'expo-router/testing-library';
import RootLayout from '../../app/_layout';
import AppLayout from '../../app/(app)/_layout';
import AuthLayout from '../../app/(auth)/_layout';
import SuspendedLayout from '../../app/(suspended)/_layout';
import PrivacyRoute from '../../app/confidentialitate';
import DeleteAccountRoute from '../../app/sterge-cont';
import PreviewRoute from '../../app/preview';
import type { AuthStatus } from './AuthProvider';

let mockStatus: AuthStatus = 'signedOut';
jest.mock('./AuthProvider', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ status: mockStatus, session: null, profile: null, refreshProfile: jest.fn(), signOut: jest.fn() }),
}));
jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: () => [true, null] }));

/** The real root and group layouts with stub screens, so only the guard logic is under test. */
const routes = {
  _layout: RootLayout,
  '(auth)/_layout': AuthLayout,
  '(auth)/index': () => <Text>welcome</Text>,
  '(onboarding)/name': () => <Text>name</Text>,
  '(onboarding)/mode': () => <Text>mode</Text>,
  '(suspended)/_layout': SuspendedLayout,
  '(suspended)/index': () => <Text>suspended</Text>,
  '(app)/_layout': AppLayout,
  '(app)/index': () => <Text>home</Text>,
  '(app)/lesson/[id]': () => <Text>lesson</Text>,
  confidentialitate: PrivacyRoute,
  'sterge-cont': DeleteAccountRoute,
  preview: PreviewRoute,
};

// Jest runs as native: the preview page shows its web-only notice, which is enough to prove the route renders.
const PREVIEW = 'Previzualizarea este disponibilă doar pe web.';
const SCREENS = ['welcome', 'name', 'mode', 'suspended', 'home', 'lesson', 'Politica de confidențialitate', 'Ștergerea contului', PREVIEW];

it.each([
  ['signedOut', '/', 'welcome'],
  ['signedOut', '/lesson/abc', 'welcome'],
  ['needsName', '/', 'name'],
  ['needsName', '/lesson/abc', 'name'],
  ['needsMode', '/', 'mode'],
  ['needsMode', '/lesson/abc', 'mode'],
  ['ready', '/', 'home'],
  ['ready', '/lesson/abc', 'lesson'],
  ['suspended', '/', 'suspended'],
  ['suspended', '/lesson/abc', 'suspended'],
  ['suspended', '/confidentialitate', 'Politica de confidențialitate'],
  ['suspended', '/sterge-cont', 'Ștergerea contului'],
  ['signedOut', '/confidentialitate', 'Politica de confidențialitate'],
  ['needsName', '/confidentialitate', 'Politica de confidențialitate'],
  ['ready', '/confidentialitate', 'Politica de confidențialitate'],
  ['signedOut', '/sterge-cont', 'Ștergerea contului'],
  ['needsName', '/sterge-cont', 'Ștergerea contului'],
  ['ready', '/sterge-cont', 'Ștergerea contului'],
  ['signedOut', '/preview', PREVIEW],
  ['needsName', '/preview', PREVIEW],
  ['ready', '/preview', PREVIEW],
] as const)('%s at %s shows %s', async (status, initialUrl, expected) => {
  mockStatus = status;
  await renderRouter(routes, { initialUrl });
  expect(await screen.findByText(expected)).toBeTruthy();
  for (const other of SCREENS.filter((t) => t !== expected)) {
    expect(screen.queryByText(other)).toBeNull();
  }
});

it('renders nothing (splash stays up) while the session is loading', async () => {
  mockStatus = 'loading';
  await renderRouter(routes, { initialUrl: '/' });
  for (const t of SCREENS) expect(screen.queryByText(t)).toBeNull();
});
