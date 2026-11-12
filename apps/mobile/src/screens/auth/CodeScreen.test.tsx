import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import CodeScreen from './CodeScreen';
import { sendEmailCode, verifyEmailCode } from '../../lib/emailAuth';
import { getPendingEmail, setPendingEmail } from '../../lib/pendingEmail';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), replace: jest.fn() },
}));
jest.mock('../../lib/emailAuth', () => ({
  ...jest.requireActual('../../lib/emailAuth'),
  sendEmailCode: jest.fn(),
  verifyEmailCode: jest.fn(),
}));

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const renderScreen = async () =>
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <CodeScreen />
    </SafeAreaProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  setPendingEmail("ana@example.com");
});
afterEach(() => jest.useRealTimers());

it('names the address and shows the mapped message for a wrong code', async () => {
  (verifyEmailCode as jest.Mock).mockRejectedValue(new Error('Codul nu este corect sau a expirat.'));
  await renderScreen();
  expect(screen.getByText('Ți-am trimis un cod de 6 cifre la ana@example.com.')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Codul din email'), '123456');
  await fireEvent.press(screen.getByRole('button', { name: 'Continuă' }));
  expect(verifyEmailCode).toHaveBeenCalledWith('ana@example.com', '123456');
  expect(await screen.findByText('Codul nu este corect sau a expirat.')).toBeTruthy();
});

it('does not call Supabase for an incomplete code', async () => {
  await renderScreen();
  await fireEvent.changeText(screen.getByLabelText('Codul din email'), '12ab');
  await fireEvent.press(screen.getByRole('button', { name: 'Continuă' }));
  expect(verifyEmailCode).not.toHaveBeenCalled();
  expect(screen.getByText('Scrie codul de 6 cifre.')).toBeTruthy();
});

it('disables resend during the 60 s cooldown and re-enables it afterwards', async () => {
  (sendEmailCode as jest.Mock).mockResolvedValue(undefined);
  await renderScreen();
  expect(screen.getByRole('button', { name: 'Retrimite în 60 s' }).props.accessibilityState.disabled).toBe(true);
  await act(async () => jest.advanceTimersByTime(15_000));
  expect(screen.getByRole('button', { name: 'Retrimite în 45 s' }).props.accessibilityState.disabled).toBe(true);
  await act(async () => jest.advanceTimersByTime(45_000));
  const resend = screen.getByRole('button', { name: 'Retrimite codul' });
  expect(resend.props.accessibilityState.disabled).toBe(false);
  await fireEvent.press(resend);
  expect(sendEmailCode).toHaveBeenCalledWith('ana@example.com');
  expect(await screen.findByRole('button', { name: 'Retrimite în 60 s' })).toBeTruthy();
});

it('goes back to change the address', async () => {
  await renderScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Schimbă adresa' }));
  expect(router.back).toHaveBeenCalled();
});

it('forgets the address once the code is accepted', async () => {
  (verifyEmailCode as jest.Mock).mockResolvedValue(undefined);
  await renderScreen();
  await fireEvent.changeText(screen.getByLabelText('Codul din email'), '123456');
  await act(async () => {});
  expect(verifyEmailCode).toHaveBeenCalledWith('ana@example.com', '123456');
  expect(getPendingEmail()).toBe('');
});

it('without a known address (opened directly), sends the student back to enter it', async () => {
  setPendingEmail('');
  await renderScreen();
  expect(screen.queryByLabelText('Codul din email')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Scrie adresa de email' }));
  expect(router.replace).toHaveBeenCalledWith('/email');
});
