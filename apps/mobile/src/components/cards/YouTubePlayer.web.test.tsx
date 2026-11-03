import { render, screen } from '@testing-library/react-native';
import YouTubePlayer from './YouTubePlayer.web';

const props = { videoId: 'dQw4w9WgXcQ', start: 5, end: 30, muted: true, onError: jest.fn() };
// A DOM element (no testID): found by type.
const frame = () => screen.container.queryAll((i) => i.type === 'iframe')[0];

it('embeds the muted, autoplaying nocookie player with the fragment bounds', async () => {
  await render(<YouTubePlayer {...props} />);
  expect(frame().type).toBe('iframe');
  expect(frame().props).toMatchObject({
    src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1&start=5&end=30',
    allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
    title: 'Video YouTube',
  });
});

it('leaves out the bounds that are not set', async () => {
  await render(<YouTubePlayer {...props} start={null} end={null} />);
  expect(frame().props.src).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1');
});

it('unmutes through the IFrame API when muted turns false, keeping the same src', async () => {
  await render(<YouTubePlayer {...props} />);
  const postMessage = jest.fn();
  // The test renderer's ref is the host instance: give it the window a browser iframe would have.
  Object.assign(frame(), { contentWindow: { postMessage } });
  const src = frame().props.src;
  await screen.rerender(<YouTubePlayer {...props} muted={false} />);
  expect(postMessage).toHaveBeenCalledWith('{"event":"command","func":"unMute","args":[]}', 'https://www.youtube-nocookie.com');
  expect(frame().props.src).toBe(src);
});
