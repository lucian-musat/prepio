import { createElement, useEffect, useMemo, useRef } from 'react';
import type { YouTubePlayerProps } from './youtube';

const ORIGIN = 'https://www.youtube-nocookie.com';

// The bit of HTMLIFrameElement used here (the app is typed without the DOM lib).
type Frame = { contentWindow?: { postMessage: (message: string, targetOrigin: string) => void } | null };
type Message = { source: unknown; origin: string; data: unknown };
type MessageWindow = {
  addEventListener: (type: 'message', listener: (e: Message) => void) => void;
  removeEventListener: (type: 'message', listener: (e: Message) => void) => void;
};

function embedUrl(videoId: string, start: number | null, end: number | null): string {
  const params = ['autoplay=1', 'mute=1', 'playsinline=1', 'rel=0', 'enablejsapi=1'];
  if (start !== null) params.push(`start=${start}`);
  if (end !== null) params.push(`end=${end}`);
  return `${ORIGIN}/embed/${videoId}?${params.join('&')}`;
}

/**
 * Web YouTube player: a nocookie embed that autoplays muted (browsers block autoplay with sound) and
 * fills its parent. Unmuting and error reports go through the IFrame API's postMessage protocol, so the
 * src (and playback) never restarts. Unmounting removes the iframe, which stops playback.
 */
export default function YouTubePlayer({ videoId, start, end, muted, onError }: YouTubePlayerProps) {
  const ref = useRef<Frame>(null);
  const src = useMemo(() => embedUrl(videoId, start, end), [videoId, start, end]);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const send = (message: object) => ref.current?.contentWindow?.postMessage(JSON.stringify(message), ORIGIN);

  useEffect(() => {
    if (!muted) send({ event: 'command', func: 'unMute', args: [] });
  }, [muted]);

  // Player errors (removed, private, embedding disabled) arrive as `onError` messages once we listen.
  useEffect(() => {
    const win = (globalThis as { window?: MessageWindow }).window;
    if (!win?.addEventListener) return;
    const onMessage = (e: Message) => {
      if (e.origin !== ORIGIN || e.source !== ref.current?.contentWindow || typeof e.data !== 'string') return;
      try {
        if ((JSON.parse(e.data) as { event?: string }).event === 'onError') onErrorRef.current();
      } catch {
        // Not an IFrame API message.
      }
    };
    win.addEventListener('message', onMessage);
    return () => win.removeEventListener('message', onMessage);
  }, []);

  const onLoad = () => {
    send({ event: 'listening', id: videoId, channel: 'widget' });
    send({ event: 'command', func: 'addEventListener', args: ['onError'], id: videoId, channel: 'widget' });
  };

  return createElement('iframe', {
    ref,
    src,
    title: 'Video YouTube',
    allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
    allowFullScreen: true,
    onLoad,
    style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 },
  });
}
