import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import NameScreen from './NameScreen';
import { updateDisplayName } from '../../lib/profile';

const mockRefresh = jest.fn();
let mockSession: { user: { id: string } } | null = { user: { id: 'u1' } };
jest.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({ session: mockSession, refreshProfile: mockRefresh, signOut: jest.fn() }),
}));
jest.mock('../../lib/profile', () => ({
  ...jest.requireActual('../../lib/profile'),
  updateDisplayName: jest.fn(),
}));

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const renderScreen = async () =>
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <NameScreen />
    </SafeAreaProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockSession = { user: { id: 'u1' } };
});

it('rejects a spaces-only name without saving', async () => {
  await renderScreen();
  await fireEvent.changeText(screen.getByLabelText('Numele tău'), '   ');
  await fireEvent.press(screen.getByRole('button', { name: 'Continuă' }));
  expect(screen.getByText('Scrie-ți numele.')).toBeTruthy();
  expect(updateDisplayName).not.toHaveBeenCalled();
  expect(mockRefresh).not.toHaveBeenCalled();
});

it('saves the name and refreshes the profile', async () => {
  (updateDisplayName as jest.Mock).mockResolvedValue(undefined);
  await renderScreen();
  await fireEvent.changeText(screen.getByLabelText('Numele tău'), ' Ana ');
  await fireEvent.press(screen.getByRole('button', { name: 'Continuă' }));
  expect(updateDisplayName).toHaveBeenCalledWith('u1', ' Ana ');
  expect(mockRefresh).toHaveBeenCalled();
});

it('shows the offline message when there is no session', async () => {
  mockSession = null;
  await renderScreen();
  await fireEvent.changeText(screen.getByLabelText('Numele tău'), 'Ana');
  await fireEvent.press(screen.getByRole('button', { name: 'Continuă' }));
  expect(await screen.findByText('Nu ne-am putut conecta. Verifică internetul și încearcă din nou.')).toBeTruthy();
  expect(updateDisplayName).not.toHaveBeenCalled();
});

it('shows a save failure and does not refresh', async () => {
  (updateDisplayName as jest.Mock).mockRejectedValue(new Error('Numele nu a putut fi salvat. Încearcă din nou.'));
  await renderScreen();
  await fireEvent.changeText(screen.getByLabelText('Numele tău'), 'Ana');
  await fireEvent.press(screen.getByRole('button', { name: 'Continuă' }));
  expect(await screen.findByText('Numele nu a putut fi salvat. Încearcă din nou.')).toBeTruthy();
  expect(mockRefresh).not.toHaveBeenCalled();
});
