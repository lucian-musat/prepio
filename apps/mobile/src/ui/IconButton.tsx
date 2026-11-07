import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { border, color, layout, motion, opacity, pressScale, radius, space, stroke } from '@prepio/shared';
import { timing } from './motion';

// Paths from the prototype's `svg` object (24×24 viewBox).
const paths = {
  back: 'M15 18l-6-6 6-6',
  'chevron-right': 'M9 18l6-6-6-6',
  check: 'M20 6L9 17l-5-5',
  close: 'M18 6L6 18M6 6l12 12',
  up: 'M18 15l-6-6-6 6',
  down: 'M6 9l6 6 6-6',
  text: 'M4 6h16M4 12h16M4 18h10',
  images: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M9 9.5a.5.5 0 1 0 .01 0',
  video: 'M3 6h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H3zM17 10l4-2v8l-4-2',
  timeline: 'M3 12h18M6 12v-4M12 12v4M18 12v-4M6 7.5v.01M12 16.5v.01M18 7.5v.01',
  schema: 'M9 4h6v5H9zM3 15h6v5H3zM15 15h6v5h-6zM12 9v3M6 15v-3h12v3',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  plus: 'M12 5v14M5 12h14',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 7.5v.01',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4M12 15v2',
} as const;

export type IconName = keyof typeof paths;

const SIZE = space[10]; // 40 px visual
// The pressable is 48 px (touch target) with negative margins, so it lays out as 40 px. Not hitSlop:
// react-native-web ignores it.
const OUTSET = (layout.minTouch - SIZE) / 2;
const ICON = space[5]; // 20 px glyph

export function Icon({ name, size = ICON, stroke: strokeWidth = stroke.icon, tint = color.text }: { name: IconName; size?: number; stroke?: number; tint?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={paths[name]} stroke={tint} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

type Props = {
  icon: IconName;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
};

/** Square 40 px icon button (48 px hit area) that shrinks slightly while pressed. */
export default function IconButton({ icon, accessibilityLabel, onPress, disabled = false }: Props) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const press = (to: number) => () => {
    scale.value = withTiming(to, timing(motion.duration.fast));
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={press(pressScale.icon)}
      onPressOut={press(1)}
      style={styles.hit}
    >
      <Animated.View style={[styles.box, disabled && styles.disabled, animated]}>
        <Icon name={icon} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { width: layout.minTouch, height: layout.minTouch, margin: -OUTSET, alignItems: 'center', justifyContent: 'center' },
  box: {
    width: SIZE,
    height: SIZE,
    borderRadius: radius.sm,
    borderWidth: border.hairline,
    borderColor: color.border,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: opacity.disabledIcon },
});
