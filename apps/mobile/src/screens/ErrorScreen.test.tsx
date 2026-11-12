import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import ErrorScreen from './ErrorScreen';
import { captureError } from '../lib/sentry';

jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => false } }));

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const renderScreen = async (retry = jest.fn().mockResolvedValue(undefined)) => {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ErrorScreen error={new Error('secret internal detail')} retry={retry} />
    </SafeAreaProvider>,
  );
  return retry;
};

beforeEach(() => jest.clearAllMocks());

it('shows the generic message and never the error text', async () => {
  await renderScreen();
  expect(screen.getByText('Ceva n-a mers bine')).toBeTruthy();
  expect(screen.getByText('Ceva n-a mers bine. Am primit eroarea și ne uităm la ea.')).toBeTruthy();
  expect(screen.queryByText(/secret internal detail/)).toBeNull();
});

it('retries', async () => {
  const retry = await renderScreen();
  await fireEvent.press(screen.getByText('Încearcă din nou'));
  expect(retry).toHaveBeenCalledTimes(1);
});

it('goes to the start', async () => {
  await renderScreen();
  await fireEvent.press(screen.getByText('Mergi la început'));
  expect(router.replace).toHaveBeenCalledWith('/');
});

it('reports the error once on mount', async () => {
  await renderScreen();
  expect(captureError).toHaveBeenCalledTimes(1);
  expect(captureError).toHaveBeenCalledWith(new Error('secret internal detail'), { handled: false });
  await fireEvent.press(screen.getByText('Mergi la început'));
  expect(captureError).toHaveBeenCalledTimes(1);
});
