import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import HomeScreen from './HomeScreen';
import { fetchHome } from '../lib/content';

jest.mock('../lib/content', () => ({ fetchHome: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
let mockProfile: { id: string; displayName: string | null } | null = { id: 'u1', displayName: 'ana' };
jest.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ profile: mockProfile }) }));

const mockedFetch = fetchHome as jest.Mock;

// Reanimated's jest helpers; the public typings only describe the no-op production stubs.
const { getAnimatedStyle } = Reanimated as unknown as { getAnimatedStyle: (node: unknown) => { opacity: number } };

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

const renderHome = async () =>
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <HomeScreen />
    </SafeAreaProvider>,
  );

const lesson = (id: string, title: string, position = 1) => ({ id, nodeId: 'n', title, position });

beforeEach(() => {
  jest.clearAllMocks();
  mockProfile = { id: 'u1', displayName: 'ana' };
});

it('shows a profile button with the initial and opens the profile', async () => {
  mockedFetch.mockResolvedValue({ welcomeMessage: 'x', sections: [] });
  await renderHome();
  expect(screen.getByText('A')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Profil' }));
  expect(router.push).toHaveBeenCalledWith('/profile');
});

it('falls back to a question mark when the student has no name', async () => {
  mockProfile = { id: 'u1', displayName: null };
  mockedFetch.mockResolvedValue({ welcomeMessage: 'x', sections: [] });
  await renderHome();
  expect(screen.getByText('?')).toBeTruthy();
});

it('renders the welcome message and lessons grouped under section headers', async () => {
  mockedFetch.mockResolvedValue({
    welcomeMessage: 'Bun venit la Prepio!',
    sections: [
      { path: ['A. Evul Mediu'], lessons: [{ id: 'l0', nodeId: 'a', title: 'Lecția zero', position: 1 }] },
      {
        path: ['C. Statul', 'Instituții'],
        lessons: [{ id: 'l1', nodeId: 'c', title: 'Lecția unu', position: 1 }],
      },
    ],
  });
  await renderHome();
  expect(await screen.findByText('Bun venit la Prepio!')).toBeTruthy();
  expect(screen.getByText('A. Evul Mediu')).toBeTruthy();
  expect(screen.getByText('C. Statul › Instituții')).toBeTruthy();
  expect(screen.getByText('Lecția zero')).toBeTruthy();
  expect(screen.getByText('Lecția unu')).toBeTruthy();
});

it('shows a Romanian error with a retry button when the fetch fails', async () => {
  mockedFetch.mockRejectedValueOnce(new Error('network'));
  await renderHome();
  expect(await screen.findByText(/Nu am putut încărca lecțiile/)).toBeTruthy();
  mockedFetch.mockResolvedValueOnce({ welcomeMessage: 'Salut', sections: [] });
  await fireEvent.press(screen.getByText('Reîncearcă'));
  expect(await screen.findByText('Salut')).toBeTruthy();
  expect(mockedFetch).toHaveBeenCalledTimes(2);
});

it('navigates to the lesson when tapped', async () => {
  mockedFetch.mockResolvedValue({
    welcomeMessage: 'x',
    sections: [{ path: ['A'], lessons: [{ id: 'abc', nodeId: 'a', title: 'Lecția', position: 1 }] }],
  });
  await renderHome();
  await fireEvent.press(await screen.findByText('Lecția'));
  await waitFor(() => expect(router.push).toHaveBeenCalledWith('/lesson/abc'));
});

it('shows a spinner while loading', async () => {
  mockedFetch.mockReturnValue(new Promise(() => {}));
  await renderHome();
  expect(screen.getByLabelText('Se încarcă')).toBeTruthy();
});

it('shows the welcome message in the hero', async () => {
  mockedFetch.mockResolvedValue({ welcomeMessage: 'Lecții scurte și exerciții.', sections: [] });
  await renderHome();
  const hero = await screen.findByTestId('hero');
  expect(screen.getByText('Bine ai venit!')).toBeTruthy();
  expect(screen.getByText('Pregătește BAC-ul, pas cu pas.')).toBeTruthy();
  expect(hero).toContainElement(screen.getByText('Lecții scurte și exerciții.'));
});

it('shows the total lesson count chip', async () => {
  mockedFetch.mockResolvedValue({
    welcomeMessage: 'x',
    sections: [
      { path: ['A'], lessons: [lesson('a1', 'Unu'), lesson('a2', 'Doi', 2)] },
      { path: ['B'], lessons: [lesson('b1', 'Trei')] },
    ],
  });
  await renderHome();
  expect(await screen.findByText('📚 3 lecții')).toBeTruthy();
  // Section captions use the same plural rule.
  expect(screen.getByText('2 lecții')).toBeTruthy();
  expect(screen.getByText('1 lecție')).toBeTruthy();
});

it('opens a lesson on press', async () => {
  mockedFetch.mockResolvedValue({
    welcomeMessage: 'x',
    sections: [{ path: ['A'], lessons: [lesson('first', 'Prima'), lesson('second', 'A doua', 2)] }],
  });
  await renderHome();
  await fireEvent.press(await screen.findByRole('button', { name: 'A doua' }));
  await waitFor(() => expect(router.push).toHaveBeenCalledWith('/lesson/second'));
  expect(router.push).toHaveBeenCalledTimes(1);
});

it('hides the welcome text when empty but keeps the title', async () => {
  mockedFetch.mockResolvedValue({ welcomeMessage: '', sections: [{ path: ['A'], lessons: [lesson('a1', 'Unu')] }] });
  await renderHome();
  expect(await screen.findByText('Pregătește BAC-ul, pas cu pas.')).toBeTruthy();
  expect(screen.getByText('📚 1 lecție')).toBeTruthy();
  expect(screen.queryByTestId('hero-welcome')).toBeNull();
});

describe('entrance', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('staggers hero, section header and lessons (40 + i × 50 ms, 420 ms each)', async () => {
    mockedFetch.mockResolvedValue({
      welcomeMessage: 'x',
      sections: [{ path: ['A'], lessons: [lesson('a1', 'Unu'), lesson('a2', 'Doi', 2)] }],
    });
    await renderHome();
    await act(async () => {});
    const opacity = (id: string) => getAnimatedStyle(screen.getByTestId(id)).opacity;
    expect(opacity('enter-hero')).toBe(0);
    // 100 ms: the hero (delay 40) has started, the section header (delay 90) barely, the second lesson (delay 90) too.
    await act(async () => jest.advanceTimersByTime(100));
    expect(opacity('enter-hero')).toBeGreaterThan(opacity('enter-section-0'));
    expect(opacity('enter-lesson-a1')).toBeGreaterThan(opacity('enter-lesson-a2'));
    await act(async () => jest.advanceTimersByTime(800));
    for (const id of ['enter-hero', 'enter-section-0', 'enter-lesson-a1', 'enter-lesson-a2']) expect(opacity(id)).toBe(1);
  });
});
