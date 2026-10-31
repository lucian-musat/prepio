import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { color, elevation, motion, radius, space } from '@prepio/shared';
import { fontFamily } from '../theme/fonts';
import AppText from './AppText';
import { Icon } from './IconButton';
import { solidShadow } from './elevation';
import { easing, timing } from './motion';
import { type } from './typography';

export type OptionState = 'idle' | 'selected' | 'correct' | 'wrong';

type Props = {
  label: string;
  /** Letter shown in the key ('A', 'B', …), or 'checkbox' for multiple choice. */
  marker: string | 'checkbox';
  state: OptionState;
  onPress?: () => void;
  disabled?: boolean;
  /** Screen-reader checked state; defaults to "the learner picked it" (selected, or marked after checking). */
  checked?: boolean;
};

// Row and key colours per state (prototype `.opt`, `.opt.sel`, `.opt.ok`, `.opt.bad`).
const look = {
  idle: { border: color.border, bg: color.surface, key: color.surfaceMuted, keyText: color.textMuted },
  selected: { border: color.primary, bg: color.primarySubtle, key: color.primary, keyText: color.onPrimary },
  correct: { border: color.success, bg: color.successSubtle, key: color.success, keyText: color.onPrimary },
  wrong: { border: color.danger, bg: color.dangerSubtle, key: color.danger, keyText: color.onPrimary },
} as const;

// Prototype `.opt .k` metrics and keyframes.
const KEY_SIZE = 30;
const KEY_ICON = space[4]; // 16 px glyph
const KEY_ICON_STROKE = 3;
const SELECTED_SCALE = 1.08;
const POP_FROM = 0.6;
const POP_PEAK = 1.18;
const POP_PEAK_AT = 0.6; // 60 % of the pop keyframe
const SHAKE_PX = 5;
const PRESSED_SCALE = 0.98;
const BORDER = 2;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** One answer option (prototype B `.opt`), animating between idle / selected / correct / wrong. */
export default function OptionRow({ label, marker, state, onPress, disabled = false, checked }: Props) {
  const reduced = useReducedMotion();
  const target = look[state];
  const interactive = !!onPress && !disabled;

  const bg = useSharedValue<string>(target.bg);
  const border = useSharedValue<string>(target.border);
  const keyBg = useSharedValue<string>(target.key);
  const keyScale = useSharedValue(state === 'selected' ? SELECTED_SCALE : 1);
  const shakeX = useSharedValue(0);
  const pressScale = useSharedValue(1);
  const mounted = useRef(false);

  useEffect(() => {
    const first = !mounted.current;
    mounted.current = true;
    // Colours start at the right state on mount (like a CSS transition); later changes blend.
    if (!first) {
      const t = timing(motion.duration.base);
      bg.value = reduced ? target.bg : withTiming(target.bg, t);
      border.value = reduced ? target.border : withTiming(target.border, t);
      keyBg.value = reduced ? target.key : withTiming(target.key, t);
    }
    if (reduced) {
      keyScale.value = state === 'selected' ? SELECTED_SCALE : 1;
      return;
    }
    // Like the CSS keyframes, pop and shake also play when a row mounts already marked.
    if (state === 'correct') {
      const slow = motion.duration.slow;
      keyScale.value = withSequence(
        withTiming(POP_FROM, { duration: 0 }),
        withTiming(POP_PEAK, timing(slow * POP_PEAK_AT, easing.pop)),
        withTiming(1, timing(slow * (1 - POP_PEAK_AT), easing.pop)),
      );
    } else {
      keyScale.value = withTiming(state === 'selected' ? SELECTED_SCALE : 1, timing(motion.duration.base, easing.pop));
    }
    if (state === 'wrong') {
      const step = timing(motion.duration.shake / 5, easing.shake);
      shakeX.value = withSequence(
        withTiming(-SHAKE_PX, step),
        withTiming(SHAKE_PX, step),
        withTiming(-SHAKE_PX, step),
        withTiming(SHAKE_PX, step),
        withTiming(0, step),
      );
    }
  }, [state]);

  const rowStyle = useAnimatedStyle(() => ({
    backgroundColor: bg.value,
    borderColor: border.value,
    transform: [{ translateX: shakeX.value }, { scale: pressScale.value }],
  }));
  const keyStyle = useAnimatedStyle(() => ({ backgroundColor: keyBg.value, transform: [{ scale: keyScale.value }] }));

  const press = (to: number) => () => {
    if (interactive && !reduced) pressScale.value = withTiming(to, timing(motion.duration.fast));
  };

  const icon = state === 'correct' ? 'check' : state === 'wrong' ? 'close' : marker === 'checkbox' && state === 'selected' ? 'check' : null;
  const isChecked = checked ?? state !== 'idle';

  return (
    <AnimatedPressable
      accessibilityRole={marker === 'checkbox' ? 'checkbox' : 'radio'}
      accessibilityLabel={label}
      accessibilityState={{ checked: isChecked, disabled: !interactive }}
      disabled={!interactive}
      onPress={onPress}
      onPressIn={press(PRESSED_SCALE)}
      onPressOut={press(1)}
      style={[styles.row, rowStyle]}
    >
      <Animated.View style={[styles.key, keyStyle]}>
        {icon ? (
          <View testID={`option-icon-${icon}`}>
            <Icon name={icon} size={KEY_ICON} stroke={KEY_ICON_STROKE} tint={color.onPrimary} />
          </View>
        ) : marker === 'checkbox' ? null : (
          <AppText style={[styles.keyText, { color: target.keyText }]}>{marker}</AppText>
        )}
      </Animated.View>
      <AppText role="option" style={styles.label}>
        {label}
      </AppText>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[3.5],
    borderWidth: BORDER,
    borderRadius: radius.lg,
    boxShadow: solidShadow(elevation.optionRest.offsetY, elevation.optionRest.color),
  },
  key: { width: KEY_SIZE, height: KEY_SIZE, borderRadius: radius.xs, alignItems: 'center', justifyContent: 'center' },
  keyText: { ...type('caption'), fontFamily: fontFamily.bodyBold },
  label: { flex: 1 },
});
