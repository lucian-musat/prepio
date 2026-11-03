import { act, render, screen } from '@testing-library/react-native';
import YouTubePlayer from './YouTubePlayer.web';

const ORIGIN = 'https://www.youtube-nocookie.com';
const UNMUTE = '{"event":"command","func":"unMute","args":[]}';
const props = { videoId: 'dQw4w9WgXcQ', start: 5, end: 30, muted: true, onError: jest.fn() };
// A DOM element (no testID): found by type.
const frame = () => screen.container.queryAll((i) => i.type === 'iframe')[0];

// The test renderer's ref is the host instance: give it the window a browser iframe would have.
const contentWindow = { postMessage: jest.fn() };
const attachWindow = () => Object.assign(frame(), { contentWindow });
const posted = () => contentWindow.postMessage.mock.calls.map(([message]) => message as string);

// A stand-in for the page's `message` events.
type Listener = (e: { origin: string; source: unknown; data: unknown }) => void;
const win = (globalThis as unknown as { window: Record<string, unknown> }).window;
const original = { add: win.addEventListener, remove: win.removeEventListener };
let listeners: Set<Listener>;
const emit = async (data: unknown, over: { origin?: string; source?: unknown } = {}) =>
  act(async () => {
    listeners.forEach((l) => l({ origin: ORIGIN, source: contentWindow, data, ...over }));
  });
const load = async () =>
  act(async () => {
    frame().props.onLoad();
  });

beforeEach(() => {
  listeners = new Set();
  win.addEventListener = jest.fn((_: string, l: Listener) => listeners.add(l));
  win.removeEventListener = jest.fn((_: string, l: Listener) => listeners.delete(l));
  contentWindow.postMessage.mockClear();
  props.onError.mockClear();
});
afterEach(() => {
  win.addEventListener = original.add;
  win.removeEventListener = original.remove;
  jest.useRealTimers();
});

it('embeds the muted, autoplaying nocookie player with the fragment bounds', async () => {
  await render(<YouTubePlayer {...props} />);
  expect(frame().type).toBe('iframe');
  expect(frame().props).toMatchObject({
    src: `${ORIGIN}/embed/dQw4w9WgXcQ?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1&start=5&end=30`,
    allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
    title: 'Video YouTube',
  });
});

it('leaves out the bounds that are not set and encodes the id', async () => {
  await render(<YouTubePlayer {...props} videoId="a/b?c" start={null} end={null} />);
  expect(frame().props.src).toBe(`${ORIGIN}/embed/a%2Fb%3Fc?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1`);
});

it('on load sends the IFrame API handshake to the nocookie origin, repeating it until the player answers', async () => {
  jest.useFakeTimers();
  await render(<YouTubePlayer {...props} />);
  attachWindow();
  await load();
  expect(contentWindow.postMessage).toHaveBeenCalledWith('{"event":"listening","id":"dQw4w9WgXcQ","channel":"widget"}', ORIGIN);
  expect(contentWindow.postMessage).toHaveBeenCalledWith(
    '{"event":"command","func":"addEventListener","args":["onError"],"id":"dQw4w9WgXcQ","channel":"widget"}',
    ORIGIN,
  );
  expect(contentWindow.postMessage.mock.calls.every(([, origin]) => origin === ORIGIN)).toBe(true);
  await act(async () => jest.advanceTimersByTime(250));
  expect(posted().filter((m) => m.includes('listening'))).toHaveLength(2);
  await emit('{"event":"onReady"}');
  await act(async () => jest.advanceTimersByTime(1000));
  expect(posted().filter((m) => m.includes('listening'))).toHaveLength(2);
});

it('an unmute requested before the player is ready is applied once it is', async () => {
  await render(<YouTubePlayer {...props} />);
  attachWindow();
  await screen.rerender(<YouTubePlayer {...props} muted={false} />);
  await load();
  expect(posted()).not.toContain(UNMUTE);
  await emit('{"event":"onReady"}');
  await emit('{"event":"infoDelivery","info":{}}');
  expect(posted().filter((m) => m === UNMUTE)).toHaveLength(1);
});

it('once ready, unmutes when muted turns false, keeping the same src', async () => {
  await render(<YouTubePlayer {...props} />);
  attachWindow();
  await load();
  await emit('{"event":"onReady"}');
  expect(posted()).not.toContain(UNMUTE);
  const src = frame().props.src;
  await screen.rerender(<YouTubePlayer {...props} muted={false} />);
  expect(contentWindow.postMessage).toHaveBeenCalledWith(UNMUTE, ORIGIN);
  expect(frame().props.src).toBe(src);
});

it('reports a player error from its own iframe', async () => {
  await render(<YouTubePlayer {...props} />);
  attachWindow();
  await emit('{"event":"onError","info":150}');
  expect(props.onError).toHaveBeenCalledTimes(1);
});

it('ignores messages from another origin, another window or that are not API JSON', async () => {
  await render(<YouTubePlayer {...props} muted={false} />);
  attachWindow();
  await emit('{"event":"onError","info":150}', { origin: 'https://evil.example' });
  await emit('{"event":"onError","info":150}', { source: { postMessage: jest.fn() } });
  await emit('not json');
  await emit({ event: 'onError' });
  expect(props.onError).not.toHaveBeenCalled();
  // None of them counted as the player becoming ready either.
  expect(posted()).not.toContain(UNMUTE);
});

it('removes its message listener and stops the handshake on unmount', async () => {
  jest.useFakeTimers();
  await render(<YouTubePlayer {...props} />);
  attachWindow();
  await load();
  expect(listeners.size).toBe(1);
  await screen.unmount();
  expect(listeners.size).toBe(0);
  const sent = contentWindow.postMessage.mock.calls.length;
  await act(async () => jest.advanceTimersByTime(1000));
  expect(contentWindow.postMessage.mock.calls.length).toBe(sent);
});
