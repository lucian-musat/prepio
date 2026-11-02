import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ProfileScreen from './ProfileScreen';
import { updateDisplayName } from '../lib/profile';
import { deleteAccount } from '../lib/api';

const mockRefresh = jest.fn();
const mockSignOut = jest.fn();
let mockSession: { user: { id: string } } | null = { user: { id: 'u1' } };
jest.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    session: mockSession,
    profile: { id: 'u1', displayName: 'Ana' },
    refreshProfile: mockRefresh,
    signOut: mockSignOut,
  }),
}));
jest.mock('../lib/profile', () => ({
  ...jest.requireActual('../lib/profile'),
  updateDisplayName: jest.fn(),
}));
jest.mock('../lib/api', () => ({ deleteAccount: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true } }));

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const renderScreen = async () =>
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ProfileScreen />
    </SafeAreaProvider>,
  );

const OFFLINE = 'Nu ne-am putut conecta. Verifică internetul și încearcă din nou.';
const CONFIRM = 'Ștergi contul definitiv? Numele, emailul și tot ce ține de cont se șterg și nu mai pot fi recuperate.';

beforeEach(() => {
  jest.clearAllMocks();
  mockSession = { user: { id: 'u1' } };
});

it('shows the current name', async () => {
  await renderScreen();
  expect(screen.getByText('Profilul tău')).toBeTruthy();
  expect(screen.getByLabelText('Nume').props.value).toBe('Ana');
});

it('saves the trimmed name and refreshes the profile', async () => {
  (updateDisplayName as jest.Mock).mockResolvedValue(undefined);
  await renderScreen();
  await fireEvent.changeText(screen.getByLabelText('Nume'), '  Maria ');
  await fireEvent.press(screen.getByRole('button', { name: 'Salvează' }));
  await waitFor(() => expect(updateDisplayName).toHaveBeenCalledWith('u1', 'Maria'));
  expect(mockRefresh).toHaveBeenCalled();
});

it('rejects an empty name without saving', async () => {
  await renderScreen();
  await fireEvent.changeText(screen.getByLabelText('Nume'), '   ');
  await fireEvent.press(screen.getByRole('button', { name: 'Salvează' }));
  expect(screen.getByText('Scrie-ți numele.')).toBeTruthy();
  expect(updateDisplayName).not.toHaveBeenCalled();
});

it('shows the offline message when renaming without a session', async () => {
  mockSession = null;
  await renderScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Salvează' }));
  expect(await screen.findByText(OFFLINE)).toBeTruthy();
  expect(updateDisplayName).not.toHaveBeenCalled();
});

it('signs out', async () => {
  await renderScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Ieși din cont' }));
  expect(mockSignOut).toHaveBeenCalled();
});

it('requires the confirm step before deleting', async () => {
  await renderScreen();
  expect(screen.queryByText(CONFIRM)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Șterge contul' }));
  expect(screen.getByText(CONFIRM)).toBeTruthy();
  expect(deleteAccount).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Renunță' }));
  expect(screen.queryByText(CONFIRM)).toBeNull();
  expect(deleteAccount).not.toHaveBeenCalled();
});

it('deletes the account then signs out', async () => {
  (deleteAccount as jest.Mock).mockResolvedValue(undefined);
  await renderScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Șterge contul' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Da, șterge contul' }));
  await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
  expect(deleteAccount).toHaveBeenCalled();
});

it('shows the failure message and stays signed in when deletion fails', async () => {
  (deleteAccount as jest.Mock).mockRejectedValue(new Error('Contul nu a putut fi șters.'));
  await renderScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Șterge contul' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Da, șterge contul' }));
  expect(await screen.findByText('Contul nu a putut fi șters.')).toBeTruthy();
  expect(mockSignOut).not.toHaveBeenCalled();
});

it('shows the offline message when deleting without a session', async () => {
  mockSession = null;
  await renderScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Șterge contul' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Da, șterge contul' }));
  expect(await screen.findByText(OFFLINE)).toBeTruthy();
  expect(deleteAccount).not.toHaveBeenCalled();
});
