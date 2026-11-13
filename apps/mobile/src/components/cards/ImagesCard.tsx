import { useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type ImageLoadEvent } from 'react-native';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import { color, radius, space, type CardContent, type CardImage } from '@prepio/shared';
import { AppText } from '../../ui';
import { imageUrl } from '../../lib/content';
import RichText from './RichText';
import ImageViewer from './ImageViewer';
import { t } from '../../texts/store';

const FALLBACK_RATIO = 16 / 9;
const THUMB = 64;
// A portrait photo at full width fills the screen; capped, its caption and the card's text stay in view.
const MAX_IMAGE_SHARE = 0.45;
// Native: the gesture-handler scroll view, so scrolling the thumbnails wins over the card stepper's swipe.
// Web: the browser's own horizontal scroll already takes the touch over (pointercancel).
const ThumbStrip = Platform.OS === 'web' ? ScrollView : GestureScrollView;

/**
 * A tappable image at its natural aspect ratio (16:9 until loaded), at most 45 % of the screen height (letterboxed
 * inside). A failed image is reported to the parent, which drops it with its credit.
 */
function CardImageView({ image, testID, onPress, onFail }: { image: CardImage; testID: string; onPress: () => void; onFail: () => void }) {
  const [ratio, setRatio] = useState(FALLBACK_RATIO);
  const maxHeight = Math.round(useWindowDimensions().height * MAX_IMAGE_SHARE);
  const uri = imageUrl(image.path);

  const onLoad = (e: ImageLoadEvent) => {
    // Native passes the decoded size in `source`; react-native-web passes the DOM load event (no `source`).
    const source = (e.nativeEvent as { source?: { width?: number; height?: number } } | undefined)?.source;
    if (source?.width && source.height) return setRatio(source.width / source.height);
    Image.getSize(
      uri,
      (w, h) => {
        if (w > 0 && h > 0) setRatio(w / h);
      },
      () => {},
    );
  };
  return (
    // "button", not "imagebutton": react-native-web maps "imagebutton" to no role.
    <Pressable accessibilityRole="button" accessibilityLabel={image.alt} onPress={onPress}>
      <Image
        testID={testID}
        source={{ uri }}
        resizeMode="contain"
        onLoad={onLoad}
        onError={onFail}
        accessible={false}
        style={[styles.image, { aspectRatio: ratio, maxHeight }]}
      />
    </Pressable>
  );
}

export default function ImagesCard({ content }: { content: Extract<CardContent, { type: 'images' }> }) {
  const { images, display, text } = content;
  const [selected, setSelected] = useState(0);
  // Keyed by path, not index: in the admin live preview the author reorders, removes or replaces images.
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  if (images.length === 0) return null;

  const main = Math.min(selected, images.length - 1);
  const shown = (display === 'gallery' ? [main] : images.map((_, i) => i)).filter((i) => !failed.has(images[i].path));

  return (
    <View style={styles.root}>
      {shown.map((i) => (
        <View key={`${images[i].path}-${i}`} style={styles.figure}>
          <CardImageView image={images[i]} testID={`card-image-${i}`} onPress={() => setViewerIndex(i)} onFail={() => setFailed((f) => new Set(f).add(images[i].path))} />
          {images[i].credit ? (
            <AppText role="caption" color="textMuted">
              {images[i].credit}
            </AppText>
          ) : null}
        </View>
      ))}
      {display === 'gallery' && images.length > 1 ? (
        <ThumbStrip horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
          {images.map((image, i) => (
            <Pressable
              key={`${image.path}-${i}`}
              accessibilityRole="button"
              accessibilityLabel={t('cards.images.thumb', { n: i + 1, descriere: image.alt })}
              // aria-selected, not accessibilityState: react-native-web 0.21 drops the latter; native maps both.
              aria-selected={i === main}
              onPress={() => setSelected(i)}
              style={[styles.thumb, i === main && styles.thumbSelected]}
            >
              <Image source={{ uri: imageUrl(image.path) }} resizeMode="cover" accessible={false} style={styles.thumbImage} />
            </Pressable>
          ))}
        </ThumbStrip>
      ) : null}
      {text ? <RichText source={text} /> : null}
      {viewerIndex !== null ? <ImageViewer images={images} index={viewerIndex} onClose={() => setViewerIndex(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space[3] },
  figure: { gap: space[1] },
  image: { width: '100%', borderRadius: radius.md, backgroundColor: color.surfaceMuted },
  thumbs: { gap: space[2] },
  thumb: { borderRadius: radius.sm, borderWidth: 2, borderColor: color.border, overflow: 'hidden' },
  thumbSelected: { borderColor: color.primary },
  thumbImage: { width: THUMB, height: THUMB, backgroundColor: color.surfaceMuted },
});
