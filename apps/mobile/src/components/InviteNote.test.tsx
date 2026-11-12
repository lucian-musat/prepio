import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import InviteNote, { INVITE_NOTE_KEY } from './InviteNote';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const TEXT = 'Ai terminat prima lecție. Invită un coleg';
const mount = async (props: { finishedCount?: number; enabled?: boolean } = {}) =>
  await render(<InviteNote finishedCount={props.finishedCount ?? 1} enabled={props.enabled ?? true} />);

beforeEach(async () => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

it('shows after the first finished lesson', async () => {
  await mount();
  expect(await screen.findByText(TEXT)).toBeTruthy();
});

it('is hidden before a finished lesson', async () => {
  await mount({ finishedCount: 0 });
  await act(async () => {});
  expect(screen.queryByText(TEXT)).toBeNull();
});

it('is hidden when the feature is disabled', async () => {
  await mount({ enabled: false });
  await act(async () => {});
  expect(screen.queryByText(TEXT)).toBeNull();
});

it('dismiss hides it and remembers it', async () => {
  const { unmount } = await mount();
  { const el = await screen.findByRole('button', { name: 'Închide' }); await fireEvent.press(el); }
  expect(screen.queryByText(TEXT)).toBeNull();
  expect(await AsyncStorage.getItem(INVITE_NOTE_KEY)).toBe('1');
  await unmount();
  await mount();
  await act(async () => {});
  expect(screen.queryByText(TEXT)).toBeNull();
});

it('opening it goes to the invite screen and counts as seen', async () => {
  await mount();
  { const el = await screen.findByText(TEXT); await fireEvent.press(el); }
  expect(router.push).toHaveBeenCalledWith('/invita');
  expect(await AsyncStorage.getItem(INVITE_NOTE_KEY)).toBe('1');
  expect(screen.queryByText(TEXT)).toBeNull();
});

it('a failed write still hides the note for this visit', async () => {
  jest.spyOn(AsyncStorage, 'setItem').mockRejectedValue(new Error('blocked'));
  await mount();
  { const el = await screen.findByRole('button', { name: 'Închide' }); await fireEvent.press(el); }
  await act(async () => {});
  expect(screen.queryByText(TEXT)).toBeNull();
});

it('unreadable storage neither crashes nor shows the note', async () => {
  jest.spyOn(AsyncStorage, 'getItem').mockRejectedValue(new Error('blocked'));
  await mount();
  await act(async () => {});
  // Stay quiet rather than risk showing it on every visit.
  expect(screen.queryByText(TEXT)).toBeNull();
});
