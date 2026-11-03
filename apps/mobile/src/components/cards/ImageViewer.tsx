import { useState } from 'react';
import { Image, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture, usePinchGesture, useSimultaneousGestures } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { color, motion, space, type CardImage } from '@prepio/shared';
import { AppText, IconButton, timing } from '../../ui';
import { imageUrl } from '../../lib/content';
import { clampTranslation } from './zoomMath';

const MAX_SCALE = 4;
const TAP_SCALE = 2;

/**
 * Zoomable image. Native: pinch to zoom, drag to pan. Web: a tap toggles 2x, and a drag pans while zoomed.
 * Translation is always clamped so the image never leaves the stage.
 */
function ZoomableImage({ uri, alt }: { uri: string; alt: string }) {
  const web = Platform.OS === 'web';
  const [zoomed, setZoomed] = useState(false);
  const scale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const width = useSharedValue(0);
  const height = useSharedValue(0);
  const dragged = useSharedValue(false);

  const pinch = usePinchGesture({
    onUpdate: (e) => {
      'worklet';
      scale.value = Math.min(MAX_SCALE, Math.max(1, scale.value * e.scaleChange));
      x.value = clampTranslation(x.value, scale.value, width.value);
      y.value = clampTranslation(y.value, scale.value, height.value);
    },
    onDeactivate: () => {
      'worklet';
      if (scale.value <= 1.02) {
        scale.value = withTiming(1, timing(motion.duration.fast));
        x.value = withTiming(0, timing(motion.duration.fast));
        y.value = withTiming(0, timing(motion.duration.fast));
      }
    },
  });
  const pan = usePanGesture({
    onActivate: () => {
      'worklet';
      dragged.value = true;
    },
    onUpdate: (e) => {
      'worklet';
      if (scale.value > 1) {
        x.value = clampTranslation(x.value + e.changeX, scale.value, width.value);
        y.value = clampTranslation(y.value + e.changeY, scale.value, height.value);
      }
    },
  });
  const both = useSimultaneousGestures(pinch, pan);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }] }));

  const toggle = () => {
    if (dragged.value) {
      dragged.value = false; // the click that ends a drag is not a tap
      return;
    }
    const next = !zoomed;
    setZoomed(next);
    scale.value = withTiming(next ? TAP_SCALE : 1, timing(motion.duration.fast));
    if (!next) {
      x.value = withTiming(0, timing(motion.duration.fast));
      y.value = withTiming(0, timing(motion.duration.fast));
    }
  };

  const image = (
    <Animated.View style={[styles.fill, animated]}>
      <Image source={{ uri }} resizeMode="contain" accessible={web ? false : undefined} accessibilityLabel={web ? undefined : alt} style={styles.fill} />
    </Animated.View>
  );
  return (
    <GestureDetector gesture={web ? pan : both}>
      <View
        style={styles.fill}
        onLayout={(e) => {
          width.value = e.nativeEvent.layout.width;
          height.value = e.nativeEvent.layout.height;
        }}
      >
        {web ? (
          <Pressable accessibilityRole="imagebutton" accessibilityLabel={alt} accessibilityState={{ expanded: zoomed }} onPress={toggle} style={styles.fill}>
            {image}
          </Pressable>
        ) : (
          image
        )}
      </View>
    </GestureDetector>
  );
}

/** Full-screen image viewer: dark backdrop, close button, previous/next for several images, credit below. */
export default function ImageViewer({ images, index, onClose }: { images: CardImage[]; index: number; onClose: () => void }) {
  const [current, setCurrent] = useState(Math.min(Math.max(index, 0), images.length - 1));
  const image = images[current];
  if (!image) return null;
  const uri = imageUrl(image.path);
  const alt = `${image.alt} (mărită)`;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={styles.backdrop}>
        <View style={styles.top}>
          <IconButton icon="close" accessibilityLabel="Închide" onPress={onClose} />
        </View>
        <View style={styles.stage}>
          <ZoomableImage key={current} uri={uri} alt={alt} />
        </View>
        <View style={styles.bottom}>
          {images.length > 1 ? (
            <View style={styles.nav}>
              <IconButton icon="back" accessibilityLabel="Imaginea anterioară" disabled={current === 0} onPress={() => setCurrent(current - 1)} />
              <AppText role="caption" style={styles.light}>
                {current + 1} / {images.length}
              </AppText>
              <IconButton icon="chevron-right" accessibilityLabel="Imaginea următoare" disabled={current === images.length - 1} onPress={() => setCurrent(current + 1)} />
            </View>
          ) : null}
          {image.credit ? (
            <AppText role="caption" style={styles.light}>
              {image.credit}
            </AppText>
          ) : null}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: color.text, padding: space[4] },
  top: { alignItems: 'flex-end', paddingTop: space[4] },
  stage: { flex: 1, overflow: 'hidden', marginVertical: space[3] },
  fill: { width: '100%', height: '100%' },
  bottom: { alignItems: 'center', gap: space[3], paddingBottom: space[4] },
  nav: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  light: { color: color.surface },
});
