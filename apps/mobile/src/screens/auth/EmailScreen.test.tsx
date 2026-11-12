import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import EmailScreen from './EmailScreen';
import { sendEmailCode } from '../../lib/emailAuth';
import { getPendingEmail } from "../../lib/pendingEmail";

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), replace: jest.fn() },
}));
jest.mock('../../lib/emailAuth', () => ({ ...jest.requireActual('../../lib/emailAuth'), sendEmailCode: jest.fn() }));

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const renderScreen = async () =>
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <EmailScreen />
    </SafeAreaProvider>,
  );

beforeEach(() => jest.clearAllMocks());

it('rejects an invalid address without calling Supabase', async () => {
  await renderScreen();
  await fireEvent.changeText(screen.getByLabelText('Adresa de email'), 'abc');
  await fireEvent.press(screen.getByRole('button', { name: 'Trimite codul' }));
  expect(screen.getByText('Adresa de email nu pare corectă.')).toBeTruthy();
  expect(sendEmailCode).not.toHaveBeenCalled();
});

it('sends the code and goes to the code screen with the trimmed email', async () => {
  (sendEmailCode as jest.Mock).mockResolvedValue(undefined);
  await renderScreen();
  await fireEvent.changeText(screen.getByLabelText('Adresa de email'), '  ana@example.com ');
  await fireEvent.press(screen.getByRole('button', { name: 'Trimite codul' }));
  expect(sendEmailCode).toHaveBeenCalledWith('ana@example.com');
  expect(router.push).toHaveBeenCalledWith('/code'); // the email stays out of the URL
  expect(getPendingEmail()).toBe('ana@example.com');
});

it('shows the mapped error when sending fails', async () => {
  (sendEmailCode as jest.Mock).mockRejectedValue(new Error('Prea multe încercări. Așteaptă puțin și încearcă din nou.'));
  await renderScreen();
  await fireEvent.changeText(screen.getByLabelText('Adresa de email'), 'ana@example.com');
  await fireEvent.press(screen.getByRole('button', { name: 'Trimite codul' }));
  expect(await screen.findByText('Prea multe încercări. Așteaptă puțin și încearcă din nou.')).toBeTruthy();
  expect(router.push).not.toHaveBeenCalled();
});
