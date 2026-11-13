import { fireEvent, render, screen } from '@testing-library/react-native';
import { applyOverrides, resetTexts } from '../texts/store';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import NotFoundScreen from './NotFoundScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => false } }));

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const renderScreen = async () =>
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <NotFoundScreen />
    </SafeAreaProvider>,
  );

beforeEach(() => jest.clearAllMocks());

it('explains the page is gone', async () => {
  await renderScreen();
  expect(screen.getByText('Pagina nu există')).toBeTruthy();
  expect(screen.getByText('Linkul pe care l-ai urmat nu mai e valabil.')).toBeTruthy();
});

it('goes to the start', async () => {
  await renderScreen();
  await fireEvent.press(screen.getByText('Mergi la început'));
  expect(router.replace).toHaveBeenCalledWith('/');
});

describe('texts', () => {
  afterEach(() => resetTexts());
  it('shows the admin overrides', async () => {
    applyOverrides({ 'errors.notFound.body': '[override]', 'common.goHome': '[home]' });
    await renderScreen();
    expect(screen.getByText('[override]')).toBeTruthy();
    expect(screen.getByRole('button', { name: '[home]' })).toBeTruthy();
  });
});
