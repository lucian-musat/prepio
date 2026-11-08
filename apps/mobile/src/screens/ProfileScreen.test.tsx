import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { formatAccessDate } from '@prepio/shared';
import ProfileScreen from './ProfileScreen';
import { updateDisplayName, updateLearningMode } from '../lib/profile';
import { deleteAccount } from '../lib/api';

const mockRefresh = jest.fn();
const mockSignOut = jest.fn();
let mockMode = 'guided';
let mockSession: { user: { id: string } } | null = { user: { id: 'u1' } };
jest.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    session: mockSession,
    profile: { id: 'u1', displayName: 'Ana', learningMode: mockMode },
    refreshProfile: mockRefresh,
    signOut: mockSignOut,
  }),
}));
jest.mock('../lib/profile', () => ({
  ...jest.requireActual('../lib/profile'),
  updateDisplayName: jest.fn(),
  updateLearningMode: jest.fn(),
}));
jest.mock('../credits/CreditsProvider');
jest.mock('../access/AccessProvider');
const { mockResetAccess } = jest.requireMock<typeof import('../access/__mocks__/AccessProvider')>('../access/AccessProvider');
jest.mock('../lib/api', () => ({ ...jest.requireActual('../lib/api'), deleteAccount: jest.fn() }));
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
  mockMode = 'guided';
  mockResetAccess();
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

it('shows the current learning mode in the picker', async () => {
  mockMode = 'free';
  await renderScreen();
  expect(screen.getByText('Mod de învățare')).toBeTruthy();
  expect(screen.getByRole('radio', { name: 'Explorare liberă' }).props.accessibilityState).toMatchObject({ checked: true });
  expect(screen.getByRole('radio', { name: 'Traseu ghidat' }).props.accessibilityState).toMatchObject({ checked: false });
});

it('saves a changed learning mode immediately, refreshes the profile and confirms', async () => {
  (updateLearningMode as jest.Mock).mockResolvedValue(undefined);
  mockRefresh.mockResolvedValue({ id: 'u1', displayName: 'Ana', learningMode: 'free' });
  await renderScreen();
  await fireEvent.press(screen.getByRole('radio', { name: 'Explorare liberă' }));
  await waitFor(() => expect(updateLearningMode).toHaveBeenCalledWith('u1', 'free'));
  expect(mockRefresh).toHaveBeenCalled();
  expect(await screen.findByText('Modul a fost salvat.')).toBeTruthy();
});

it('keeps the saved mode and asks for a reload when the refreshed profile still has the old one', async () => {
  (updateLearningMode as jest.Mock).mockResolvedValue(undefined);
  mockRefresh.mockResolvedValue({ id: 'u1', displayName: 'Ana', learningMode: 'guided' });
  await renderScreen();
  await fireEvent.press(screen.getByRole('radio', { name: 'Explorare liberă' }));
  expect(await screen.findByText('Modul a fost salvat. Reîncarcă aplicația dacă nu vezi schimbarea.')).toBeTruthy();
  expect(screen.queryByText('Modul a fost salvat.')).toBeNull();
  expect(screen.getByRole('radio', { name: 'Explorare liberă' }).props.accessibilityState).toMatchObject({ checked: true });
});

it('shows the generic mode error for an Error subclass (e.g. a PostgREST error)', async () => {
  class PostgrestLike extends Error {}
  (updateLearningMode as jest.Mock).mockRejectedValue(new PostgrestLike('duplicate key value violates constraint'));
  await renderScreen();
  await fireEvent.press(screen.getByRole('radio', { name: 'Explorare liberă' }));
  expect(await screen.findByText('Modul nu a putut fi salvat. Încearcă din nou.')).toBeTruthy();
  expect(screen.queryByText(/duplicate key/)).toBeNull();
});

it('reverts the picker and shows the error when saving the mode fails', async () => {
  (updateLearningMode as jest.Mock).mockRejectedValue(new Error('Modul nu a putut fi salvat.'));
  await renderScreen();
  await fireEvent.press(screen.getByRole('radio', { name: 'Explorare liberă' }));
  expect(await screen.findByText('Modul nu a putut fi salvat.')).toBeTruthy();
  expect(screen.getByRole('radio', { name: 'Traseu ghidat' }).props.accessibilityState).toMatchObject({ checked: true });
  expect(screen.queryByText('Modul a fost salvat.')).toBeNull();
  expect(mockRefresh).not.toHaveBeenCalled();
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

it('has a „Creditele mele” row with the balance that opens the credits page', async () => {
  const { router } = jest.requireMock('expo-router');
  const { mockResetCredits } = jest.requireMock('../credits/CreditsProvider');
  mockResetCredits(49);
  await renderScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Creditele mele · 49' }));
  expect(router.push).toHaveBeenCalledWith('/credits');
});

it('shows the subscription row with the plan label above the credits row', async () => {
  await renderScreen();
  expect(screen.getByRole('button', { name: 'Abonamentul meu · Trial' })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Abonamentul meu · Trial' }));
  expect(require('expo-router').router.push).toHaveBeenCalledWith('/abonament');
});

it('labels full and expired plans', async () => {
  const d = new Date(Date.now() + 40 * 86400000);
  mockResetAccess({ accessUntil: d.toISOString() });
  const { unmount } = await renderScreen();
  expect(screen.getByRole('button', { name: `Abonamentul meu · Acces până la ${formatAccessDate(d)}` })).toBeTruthy();
  unmount();
  mockResetAccess({ accessUntil: new Date(Date.now() - 86400000).toISOString() });
  await renderScreen();
  expect(screen.getByRole('button', { name: 'Abonamentul meu · Expirat' })).toBeTruthy();
});
