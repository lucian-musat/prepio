import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { border as borderWidth, color, elevation, motion, pressScale, radius, space, stroke } from '@prepio/shared';
import { fontFamily } from '../theme/fonts';
import AppText from './AppText';
import { Icon } from './IconButton';
import { popSequence } from './Pop';
import { mixColors, solidShadow } from './elevation';
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
  /** Screen-reader name; defaults to the label (e.g. add the result after checking). */
  accessibilityLabel?: string;
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
const SELECTED_SCALE = 1.08;
const SHAKE_PX = 5;
// Prototype `.opt:hover` (idle rows only: the state colours override it).
const HOVER_BORDER = mixColors(color.primary, color.border, 0.4);

/** One answer option (prototype B `.opt`), animating between idle / selected / correct / wrong. */
export default function OptionRow({ label, marker, state, onPress, disabled = false, checked, accessibilityLabel }: Props) {
  const reduced = useReducedMotion();
  const target = look[state];
  const interactive = !!onPress && !disabled;

  const bg = useSharedValue<string>(target.bg);
  const border = useSharedValue<string>(target.border);
  const keyBg = useSharedValue<string>(target.key);
  const keyScale = useSharedValue(state === 'selected' ? SELECTED_SCALE : 1);
  const shakeX = useSharedValue(0);
  const pressed = useSharedValue(1);
  const mounted = useRef(false);
  const [hovered, setHovered] = useState(false);
  const edge = state === 'idle' && hovered && interactive ? HOVER_BORDER : target.border;

  // The only writer of the row/key colours: state and hover changes blend like a CSS transition.
  // Colours start at the right state on mount, so the first run does nothing.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const t = timing(motion.duration.base);
    const to = (value: string) => (reduced ? value : withTiming(value, t));
    bg.value = to(target.bg);
    border.value = to(edge);
    keyBg.value = to(target.key);
  }, [edge, target.bg, target.key, reduced, bg, border, keyBg]);

  // Key scale and shake follow the state only (not hover).
  useEffect(() => {
    if (reduced) {
      keyScale.value = state === 'selected' ? SELECTED_SCALE : 1;
      return;
    }
    // Like the CSS keyframes, pop and shake also play when a row mounts already marked.
    if (state === 'correct') {
      keyScale.value = popSequence(motion.duration.slow);
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
  }, [state, reduced, keyScale, shakeX]);

  const rowStyle = useAnimatedStyle(() => ({
    backgroundColor: bg.value,
    borderColor: border.value,
    transform: [{ translateX: shakeX.value }, { scale: pressed.value }],
  }));
  const keyStyle = useAnimatedStyle(() => ({ backgroundColor: keyBg.value, transform: [{ scale: keyScale.value }] }));

  const press = (to: number) => () => {
    if (interactive && !reduced) pressed.value = withTiming(to, timing(motion.duration.fast));
  };

  const icon = state === 'correct' ? 'check' : state === 'wrong' ? 'close' : marker === 'checkbox' && state === 'selected' ? 'check' : null;
  const isChecked = checked ?? state !== 'idle';

  return (
    // Static Pressable around an Animated.View (like Button / IconButton): an animated Pressable's
    // press transform does not update on react-native-web.
    <Pressable
      accessibilityRole={marker === 'checkbox' ? 'checkbox' : 'radio'}
      accessibilityLabel={accessibilityLabel ?? label}
      // Only an explicitly disabled row is announced as disabled; a display-only row (no onPress) is not.
      accessibilityState={{ checked: isChecked, disabled }}
      // react-native-web 0.21 ignores accessibilityState; the aria props reach the DOM.
      aria-checked={isChecked}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={interactive ? onPress : undefined}
      onPressIn={press(pressScale.row)}
      onPressOut={press(1)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
    >
      <Animated.View testID="option-face" style={[styles.row, rowStyle]}>
        <Animated.View style={[styles.key, keyStyle]}>
          {icon ? (
            <View testID={`option-icon-${icon}`}>
              <Icon name={icon} size={KEY_ICON} stroke={stroke.iconBold} tint={color.onPrimary} />
            </View>
          ) : marker === 'checkbox' ? null : (
            <AppText style={[styles.keyText, { color: target.keyText }]}>{marker}</AppText>
          )}
        </Animated.View>
        <AppText role="option" style={styles.label}>
          {label}
        </AppText>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[3.5],
    borderWidth: borderWidth.thick,
    borderRadius: radius.lg,
    boxShadow: solidShadow(elevation.optionRest.offsetY, elevation.optionRest.color),
  },
  key: { width: KEY_SIZE, height: KEY_SIZE, borderRadius: radius.xs, alignItems: 'center', justifyContent: 'center' },
  keyText: { ...type('caption'), fontFamily: fontFamily.bodyBold },
  label: { flex: 1 },
});
