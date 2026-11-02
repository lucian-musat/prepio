import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import WelcomeScreen from './WelcomeScreen';
import { signInWithGoogle } from '../../auth/google';
import { emailAuthEnabled } from '../../lib/flags';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../../auth/google', () => ({ signInWithGoogle: jest.fn() }));
jest.mock('../../lib/flags', () => ({ emailAuthEnabled: jest.fn() }));

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const renderWelcome = async () =>
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <WelcomeScreen />
    </SafeAreaProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  (emailAuthEnabled as jest.Mock).mockReturnValue(false);
});

it('shows the copy and the Google button', async () => {
  await renderWelcome();
  expect(screen.getByText('Bun venit la Prepio')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Continuă cu Google' })).toBeTruthy();
  expect(screen.getByText('Politica de confidențialitate')).toBeTruthy();
});

it('hides the email button when the flag is off', async () => {
  await renderWelcome();
  expect(screen.queryByText('Continuă cu email')).toBeNull();
});

it('shows the email button when the flag is on and opens the email screen', async () => {
  (emailAuthEnabled as jest.Mock).mockReturnValue(true);
  await renderWelcome();
  await fireEvent.press(screen.getByRole('button', { name: 'Continuă cu email' }));
  expect(router.push).toHaveBeenCalledWith('/email');
});

it('leaves no error text when the Google picker is cancelled', async () => {
  (signInWithGoogle as jest.Mock).mockResolvedValue('cancelled');
  await renderWelcome();
  await fireEvent.press(screen.getByRole('button', { name: 'Continuă cu Google' }));
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByRole('button', { name: 'Continuă cu Google' }).props.accessibilityState.disabled).toBe(false);
});

it('shows the error message when Google sign-in fails', async () => {
  (signInWithGoogle as jest.Mock).mockRejectedValue(new Error('Nu am putut face autentificarea.'));
  await renderWelcome();
  await fireEvent.press(screen.getByRole('button', { name: 'Continuă cu Google' }));
  expect(await screen.findByText('Nu am putut face autentificarea.')).toBeTruthy();
});

it('disables the Google button while a sign-in is pending', async () => {
  let resolve!: (v: 'cancelled') => void;
  (signInWithGoogle as jest.Mock).mockReturnValue(new Promise((r) => (resolve = r)));
  await renderWelcome();
  await fireEvent.press(screen.getByRole('button', { name: 'Continuă cu Google' }));
  expect(screen.getByRole('button', { name: 'Continuă cu Google' }).props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(screen.getByRole('button', { name: 'Continuă cu Google' }));
  expect(signInWithGoogle).toHaveBeenCalledTimes(1);
  await act(async () => resolve('cancelled'));
});
