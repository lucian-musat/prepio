import { Linking } from 'react-native';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Card, CardContent } from '@prepio/shared';
import { CardTransition } from '../../ui';
import CardStepper from '../CardStepper';
import VideoCard from './VideoCard';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => false } }));

// The real player is a WebView (native) or an iframe (web): a host View stands in, carrying its props
// and counting live instances so a test can tell that leaving the card unmounted it.
const mockLive = { count: 0 };
jest.mock('./YouTubePlayer', () => {
  const { createElement, useEffect } = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: object) => {
      useEffect(() => {
        mockLive.count += 1;
        return () => {
          mockLive.count -= 1;
        };
      }, []);
      return createElement(View, { testID: 'youtube-player', ...props });
    },
  };
});

type Video = Extract<CardContent, { type: 'video' }>;
const video = (over: Partial<Video> = {}): Video => ({ type: 'video', youtubeId: 'dQw4w9WgXcQ', startSeconds: 5, endSeconds: 30, text: null, ...over });
const player = () => screen.getByTestId('youtube-player');
const all = { includeHiddenElements: true };

beforeEach(() => {
  mockLive.count = 0;
});

it('an active card autoplays the video muted, with its fragment', async () => {
  await render(<VideoCard content={video()} />);
  expect(player().props).toMatchObject({ videoId: 'dQw4w9WgXcQ', start: 5, end: 30, muted: true });
  expect(screen.getByLabelText('Pornește sunetul')).toBeTruthy();
  expect(screen.getByText('🔇 Atinge pentru sunet')).toBeTruthy();
  expect(screen.getByLabelText('Pornește sunetul').props.hitSlop).toBe(8);
});

it('passes null bounds through when the whole video plays', async () => {
  await render(<VideoCard content={video({ startSeconds: null, endSeconds: null })} />);
  expect(player().props).toMatchObject({ start: null, end: null });
});

it('tapping the pill unmutes the player and hides the pill', async () => {
  await render(<VideoCard content={video()} />);
  await fireEvent.press(screen.getByLabelText('Pornește sunetul'));
  expect(player().props.muted).toBe(false);
  expect(screen.queryByLabelText('Pornește sunetul')).toBeNull();
  expect(mockLive.count).toBe(1);
});

it('the outgoing copy in a card transition shows the thumbnail, not a second player', async () => {
  const at = (key: string, id: string) => (
    <CardTransition contentKey={key} direction="next">
      <VideoCard content={video({ youtubeId: id })} />
    </CardTransition>
  );
  await render(at('a', 'aaaaaaaaaaa'));
  await screen.rerender(at('b', 'bbbbbbbbbbb'));
  const players = screen.getAllByTestId('youtube-player', all);
  expect(players).toHaveLength(1);
  expect(players[0].props.videoId).toBe('bbbbbbbbbbb');
  expect(mockLive.count).toBe(1);
  const out = within(screen.getByTestId('card-out', all));
  expect(out.getByTestId('video-thumbnail', all).props.source).toEqual({ uri: 'https://i.ytimg.com/vi/aaaaaaaaaaa/hqdefault.jpg' });
});

it('leaving the card in the stepper stops the video', async () => {
  const cards: Card[] = [
    { id: 'v', position: 1, title: null, ...video() },
    { id: 't', position: 2, title: null, type: 'text', text: 'După video' },
  ];
  const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <CardStepper cards={cards} onFinish={jest.fn()} frame={{ title: 'Lecția', progress: 0, onBack: jest.fn() }} />
    </SafeAreaProvider>,
  );
  expect(mockLive.count).toBe(1);
  await fireEvent.press(within(screen.getByTestId('action-bar')).getByRole('button', { name: 'Continuă' }));
  expect(screen.getByText('După video')).toBeTruthy();
  expect(mockLive.count).toBe(0);
  expect(screen.queryAllByTestId('youtube-player', all)).toHaveLength(0);
});

it('when the embed fails it falls back to the thumbnail and a YouTube link', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await render(<VideoCard content={video()} />);
  await act(async () => {
    player().props.onError();
  });
  expect(screen.queryByTestId('youtube-player')).toBeNull();
  expect(screen.queryByLabelText('Pornește sunetul')).toBeNull();
  expect(screen.getByTestId('video-thumbnail').props.source).toEqual({ uri: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg' });
  await fireEvent.press(screen.getByRole('button', { name: 'Deschide pe YouTube' }));
  expect(open).toHaveBeenCalledWith('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  open.mockRestore();
});

it('an empty id renders no player', async () => {
  await render(<VideoCard content={video({ youtubeId: '' })} />);
  expect(screen.queryByTestId('youtube-player', all)).toBeNull();
  expect(screen.queryByTestId('video-thumbnail', all)).toBeNull();
  expect(screen.queryByLabelText('Pornește sunetul')).toBeNull();
});

it('renders the optional text', async () => {
  await render(<VideoCard content={video({ text: 'Despre video' })} />);
  expect(screen.getByText('Despre video')).toBeTruthy();
});
