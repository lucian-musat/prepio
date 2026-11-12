import { Linking } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import EmailLink from './EmailLink';
import DeleteAccountInfoScreen from '../screens/DeleteAccountInfoScreen';
import { CONTACT_EMAIL } from '../lib/legal';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true } }));
jest.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ status: 'signedOut', session: null }) }));

it('opens the mail app with the contact address', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
  await render(<EmailLink />);
  await fireEvent.press(screen.getByRole('link', { name: CONTACT_EMAIL }));
  expect(open).toHaveBeenCalledWith(`mailto:${CONTACT_EMAIL}`);
});

it('the account deletion page links the address', async () => {
  const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <DeleteAccountInfoScreen />
    </SafeAreaProvider>,
  );
  expect(screen.getByRole('link', { name: CONTACT_EMAIL })).toBeTruthy();
});
