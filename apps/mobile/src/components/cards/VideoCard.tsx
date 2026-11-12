import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { color, radius, space, type CardContent } from '@prepio/shared';
import { AppText, Button, useCardLeaving } from '../../ui';
import RichText from './RichText';
import { openExternal } from './openExternal';
import YouTubePlayer from './YouTubePlayer';
import { thumbnailUrl, watchUrl } from './youtube';

/**
 * A YouTube video in a 16:9 box (width-driven). The card is active while it is mounted outside the
 * transition's outgoing copy: the player then autoplays muted, with a pill to turn the sound on.
 * The outgoing copy, an empty id or a failed embed show the thumbnail instead, so leaving the card
 * (next/back/close) unmounts the player and stops it.
 */
export default function VideoCard({ content }: { content: Extract<CardContent, { type: 'video' }> }) {
  const { youtubeId, startSeconds, endSeconds, text } = content;
  const leaving = useCardLeaving();
  const [muted, setMuted] = useState(true);
  const [failed, setFailed] = useState(false);
  const live = youtubeId !== '' && !leaving && !failed;

  return (
    <View style={styles.root}>
      <View testID="video-frame" style={styles.frame}>
        {live ? (
          <YouTubePlayer videoId={youtubeId} start={startSeconds} end={endSeconds} muted={muted} onError={() => setFailed(true)} />
        ) : youtubeId ? (
          <Image testID="video-thumbnail" source={{ uri: thumbnailUrl(youtubeId) }} resizeMode="cover" accessible={false} style={StyleSheet.absoluteFill} />
        ) : null}
      </View>
      {/* Under the player, not over it: on top it covered YouTube's own title bar. */}
      {live && muted ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Pornește sunetul" hitSlop={PILL_SLOP} onPress={() => setMuted(false)} style={styles.pill}>
          <AppText role="caption" color="surface">
            🔇 Atinge pentru sunet
          </AppText>
        </Pressable>
      ) : null}
      {failed && youtubeId ? <Button variant="secondary" label="Deschide pe YouTube" onPress={() => openExternal(watchUrl(youtubeId))} /> : null}
      {text ? <RichText source={text} /> : null}
    </View>
  );
}

// The pill is small (caption text): widen its touch target towards 44 px.
const PILL_SLOP = space[2];

const styles = StyleSheet.create({
  root: { gap: space[3] },
  frame: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.md, overflow: 'hidden', backgroundColor: color.surfaceMuted },
  pill: {
    alignSelf: 'flex-start',
    marginTop: -space[1.5],
    paddingVertical: space[1],
    paddingHorizontal: space[2.5],
    borderRadius: radius.pill,
    backgroundColor: color.text,
  },
});
