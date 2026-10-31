import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { color, layout, motion, radius, space } from '@prepio/shared';
import { timing } from './motion';

// Paths from the prototype's `svg` object (24×24 viewBox).
const paths = {
  back: 'M15 18l-6-6 6-6',
  'chevron-right': 'M9 18l6-6-6-6',
  check: 'M20 6L9 17l-5-5',
  close: 'M18 6L6 18M6 6l12 12',
  up: 'M18 15l-6-6-6 6',
  down: 'M6 9l6 6 6-6',
} as const;

export type IconName = keyof typeof paths;

const SIZE = space[10]; // 40 px visual
// The pressable is 48 px (touch target) with negative margins, so it lays out as 40 px. Not hitSlop:
// react-native-web ignores it.
const OUTSET = (layout.minTouch - SIZE) / 2;
const ICON = space[5]; // 20 px glyph
const STROKE = 2.2;
const PRESSED_SCALE = 0.92;
const DISABLED_OPACITY = 0.4;

export function Icon({ name, size = ICON, stroke = STROKE, tint = color.text }: { name: IconName; size?: number; stroke?: number; tint?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={paths[name]} stroke={tint} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
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
      onPressIn={press(PRESSED_SCALE)}
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
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: DISABLED_OPACITY },
});
