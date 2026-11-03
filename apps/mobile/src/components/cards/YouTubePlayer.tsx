import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import YoutubeIframe from 'react-native-youtube-iframe';
import type { YouTubePlayerProps } from './youtube';

// Android WebViews inside a view whose opacity animates (the card transition) can crash; a
// near-opaque WebView is the usual workaround.
const WEBVIEW_STYLE = { opacity: 0.99 };

/**
 * Native YouTube player (react-native-youtube-iframe on a WebView). Fills its parent: the WebView needs
 * numeric sizes, so it mounts after the first layout. Plays on mount; unmounting removes the WebView,
 * which stops playback.
 */
export default function YouTubePlayer({ videoId, start, end, muted, onError }: YouTubePlayerProps) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) setSize({ width, height });
  };
  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout}>
      {size ? (
        <YoutubeIframe
          videoId={videoId}
          width={size.width}
          height={size.height}
          play
          mute={muted}
          initialPlayerParams={{ start: start ?? undefined, end: end ?? undefined, rel: false }}
          webViewStyle={WEBVIEW_STYLE}
          onError={() => onError()}
        />
      ) : null}
    </View>
  );
}
