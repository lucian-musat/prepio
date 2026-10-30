import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { router } from 'expo-router';
import HomeScreen from './HomeScreen';
import { fetchHome } from '../lib/content';

jest.mock('../lib/content', () => ({ fetchHome: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const mockedFetch = fetchHome as jest.Mock;

const renderHome = async () =>
  await render(
    <PaperProvider>
      <HomeScreen />
    </PaperProvider>,
  );

beforeEach(() => jest.clearAllMocks());

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