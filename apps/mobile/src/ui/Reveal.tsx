import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { motion } from '@prepio/shared';
import { easing, timing } from './motion';

type Props = {
  open: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children: ReactNode;
};

/**
 * Expands to its content's height with a fade when `open`, and collapses back. The content is measured in an
 * absolutely positioned inner view, so it never squashes while the height animates. Closing hides it from
 * screen readers at once and unmounts it when the collapse ends. With reduce motion it opens and closes instantly.
 */
export default function Reveal({ open, style, testID, children }: Props) {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(open);
  const p = useSharedValue(open ? 1 : 0);
  const height = useSharedValue(0);

  if (open && !mounted) setMounted(true);
  if (!open && mounted && reduced) setMounted(false);

  useEffect(() => {
    if (reduced) {
      p.value = open ? 1 : 0;
      return;
    }
    const t = timing(motion.duration.base, easing.out);
    p.value = open
      ? withTiming(1, t)
      : withTiming(0, t, (finished) => {
          if (finished) scheduleOnRN(setMounted, false);
        });
  }, [open, reduced, p]);

  const animated = useAnimatedStyle(() => ({ height: height.value * p.value, opacity: p.value }));

  if (!mounted) return null;
  return (
    <Animated.View
      testID={testID}
      style={[styles.clip, style, animated]}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
      aria-hidden={!open}
    >
      <View testID={testID ? `${testID}-content` : undefined} style={styles.content} onLayout={(e) => (height.value = e.nativeEvent.layout.height)}>
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  content: { position: 'absolute', top: 0, left: 0, right: 0 },
});
