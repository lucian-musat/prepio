import { createElement, useEffect, useMemo, useRef } from 'react';
import type { YouTubePlayerProps } from './youtube';

const ORIGIN = 'https://www.youtube-nocookie.com';
// Like the official IFrame API: repeat the `listening` handshake until the player answers.
const HANDSHAKE_MS = 250;
const HANDSHAKE_TRIES = 40;

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
  return `${ORIGIN}/embed/${encodeURIComponent(videoId)}?${params.join('&')}`;
}

/**
 * Web YouTube player: a nocookie embed that autoplays muted (browsers block autoplay with sound) and
 * fills its parent. Unmuting and error reports go through the IFrame API's postMessage protocol, so the
 * src (and playback) never restarts. Commands sent before the player is ready are lost, so the mute
 * state is re-applied when it first answers the handshake. Unmounting removes the iframe, which stops playback.
 */
export default function YouTubePlayer({ videoId, start, end, muted, onError }: YouTubePlayerProps) {
  const ref = useRef<Frame>(null);
  const src = useMemo(() => embedUrl(videoId, start, end), [videoId, start, end]);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const ready = useRef(false);
  const handshake = useRef<ReturnType<typeof setInterval> | null>(null);

  const send = (message: object) => ref.current?.contentWindow?.postMessage(JSON.stringify(message), ORIGIN);
  const unMute = () => send({ event: 'command', func: 'unMute', args: [] });
  const stopHandshake = () => {
    if (handshake.current !== null) clearInterval(handshake.current);
    handshake.current = null;
  };

  useEffect(() => {
    if (!muted && ready.current) unMute();
  }, [muted]);

  // Messages from this iframe only (origin and source checked): the first one marks the player ready;
  // player errors (removed, private, embedding disabled) arrive as `onError`.
  useEffect(() => {
    const win = (globalThis as { window?: MessageWindow }).window;
    if (!win?.addEventListener) return;
    const onMessage = (e: Message) => {
      if (e.origin !== ORIGIN || e.source !== ref.current?.contentWindow || typeof e.data !== 'string') return;
      let event: string | undefined;
      try {
        event = (JSON.parse(e.data) as { event?: string }).event;
      } catch {
        return; // Not an IFrame API message.
      }
      if (!ready.current) {
        ready.current = true;
        stopHandshake();
        if (!mutedRef.current) unMute();
      }
      if (event === 'onError') onErrorRef.current();
    };
    win.addEventListener('message', onMessage);
    return () => {
      win.removeEventListener('message', onMessage);
      stopHandshake();
    };
  }, []);

  const onLoad = () => {
    const hello = () => {
      send({ event: 'listening', id: videoId, channel: 'widget' });
      send({ event: 'command', func: 'addEventListener', args: ['onError'], id: videoId, channel: 'widget' });
    };
    ready.current = false;
    stopHandshake();
    hello();
    let tries = 1;
    handshake.current = setInterval(() => {
      if (++tries > HANDSHAKE_TRIES) stopHandshake();
      else hello();
    }, HANDSHAKE_MS);
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
