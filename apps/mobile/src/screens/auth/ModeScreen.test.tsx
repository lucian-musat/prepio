import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ModeScreen from './ModeScreen';
import { updateLearningMode } from '../../lib/profile';

const mockRefresh = jest.fn();
let mockSession: { user: { id: string } } | null = { user: { id: 'u1' } };
jest.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({ session: mockSession, refreshProfile: mockRefresh, signOut: jest.fn() }),
}));
jest.mock('../../lib/profile', () => ({
  ...jest.requireActual('../../lib/profile'),
  updateLearningMode: jest.fn(),
}));

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const renderScreen = async () =>
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ModeScreen />
    </SafeAreaProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockSession = { user: { id: 'u1' } };
});

it('shows the title and subtitle with the guided mode preselected', async () => {
  await renderScreen();
  expect(screen.getByText('Cum vrei să înveți?')).toBeTruthy();
  expect(screen.getByText('Poți schimba oricând din Profil.')).toBeTruthy();
  expect(screen.getByRole('radio', { name: /Traseu ghidat/ }).props.accessibilityState).toMatchObject({ checked: true });
});

it('saves the guided mode and refreshes the profile', async () => {
  (updateLearningMode as jest.Mock).mockResolvedValue(undefined);
  mockRefresh.mockResolvedValue({ id: 'u1', displayName: 'Ana', learningMode: 'guided' });
  await renderScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Continuă' }));
  expect(updateLearningMode).toHaveBeenCalledWith('u1', 'guided');
  expect(mockRefresh).toHaveBeenCalled();
  expect(screen.queryByRole('alert')).toBeNull();
});

it('shows an alert when the refreshed profile does not have the chosen mode', async () => {
  (updateLearningMode as jest.Mock).mockResolvedValue(undefined);
  mockRefresh.mockResolvedValue({ id: 'u1', displayName: 'Ana', learningMode: null });
  await renderScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Continuă' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Nu am putut confirma alegerea. Încearcă din nou.');
  expect(screen.getByText('Cum vrei să înveți?')).toBeTruthy();
});

it('saves the free mode when it is chosen', async () => {
  (updateLearningMode as jest.Mock).mockResolvedValue(undefined);
  await renderScreen();
  await fireEvent.press(screen.getByRole('radio', { name: /Explorare liberă/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Continuă' }));
  expect(updateLearningMode).toHaveBeenCalledWith('u1', 'free');
});

it('shows the offline message when there is no session', async () => {
  mockSession = null;
  await renderScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Continuă' }));
  expect(await screen.findByText('Nu ne-am putut conecta. Verifică internetul și încearcă din nou.')).toBeTruthy();
  expect(updateLearningMode).not.toHaveBeenCalled();
});

it('shows a save failure as an alert and stays on the screen', async () => {
  (updateLearningMode as jest.Mock).mockRejectedValue(new Error('Modul nu a putut fi salvat. Încearcă din nou.'));
  await renderScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Continuă' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Modul nu a putut fi salvat. Încearcă din nou.');
  expect(mockRefresh).not.toHaveBeenCalled();
  expect(screen.getByText('Cum vrei să înveți?')).toBeTruthy();
});
