import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SuspendedScreen from './SuspendedScreen';
import { deleteAccount } from '../lib/api';
import { CONTACT_EMAIL } from '../lib/legal';

const mockSignOut = jest.fn();
let mockReason: string | null = 'Cont creat pentru test.';
jest.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    session: { user: { id: 'u1' } },
    profile: { id: 'u1', displayName: 'Ana', learningMode: 'guided', creditBalance: 0, suspendedReason: mockReason },
    refreshProfile: jest.fn(),
    signOut: mockSignOut,
  }),
}));
jest.mock('../lib/api', () => ({ ...jest.requireActual('../lib/api'), deleteAccount: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => false } }));

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const renderScreen = async () =>
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <SuspendedScreen />
    </SafeAreaProvider>,
  );

const CONFIRM = 'Ștergi contul definitiv? Se șterg numele, emailul, progresul, creditele și accesul, și nu le mai poți recupera.';

beforeEach(() => {
  jest.clearAllMocks();
  mockReason = 'Cont creat pentru test.';
});

it('shows the title, the reason and the contact address', async () => {
  await renderScreen();
  expect(screen.getByText('Contul tău a fost suspendat')).toBeTruthy();
  expect(screen.getByText('Motiv:')).toBeTruthy();
  expect(screen.getByText('Cont creat pentru test.', { exact: false })).toBeTruthy();
  expect(screen.getByText(`Dacă crezi că e o greșeală, scrie-ne la ${CONTACT_EMAIL}.`)).toBeTruthy();
});

it('never mentions AI', async () => {
  await renderScreen();
  expect(JSON.stringify(screen.toJSON())).not.toMatch(/\bAI\b/);
});

it('signs out', async () => {
  await renderScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Ieși din cont' }));
  expect(mockSignOut).toHaveBeenCalled();
});

it('Șterge contul opens the confirmation; Renunță closes it without deleting', async () => {
  await renderScreen();
  expect(screen.queryByText(CONFIRM)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Șterge contul' }));
  expect(screen.getByText(CONFIRM)).toBeTruthy();
  expect(deleteAccount).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Renunță' }));
  expect(screen.queryByText(CONFIRM)).toBeNull();
});

it('confirming deletes the account, then signs out', async () => {
  (deleteAccount as jest.Mock).mockResolvedValue(undefined);
  await renderScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Șterge contul' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Da, șterge contul' }));
  await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
  expect(deleteAccount).toHaveBeenCalledTimes(1);
});

it('shows the deletion error and stays signed in', async () => {
  (deleteAccount as jest.Mock).mockRejectedValue(new Error('Contul nu a putut fi șters.'));
  await renderScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Șterge contul' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Da, șterge contul' }));
  expect(await screen.findByText('Contul nu a putut fi șters.')).toBeTruthy();
  expect(mockSignOut).not.toHaveBeenCalled();
});
