import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { color, elevation, feedbackText, motion, radius, space } from '@prepio/shared';
import AppText from './AppText';
import Spinner from './Spinner';
import { easing, timing } from './motion';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  tone?: 'primary' | 'success' | 'danger';
  flex?: boolean;
};

// Face colour and the darker shade drawn under it. The success/danger shades are the prototype's
// color-mix(tone 75%, black), which are exactly the feedback text tones.
const tones = {
  primary: { face: color.primary, shade: color.primaryStrong },
  success: { face: color.success, shade: feedbackText.good },
  danger: { face: color.danger, shade: feedbackText.wrong },
} as const;

const PRIMARY_DEPTH = elevation.button.offsetY; // 4 px
const GHOST_DEPTH = elevation.optionRest.offsetY; // 3 px, prototype B `.btn.ghost`
const PRESSED_DEPTH = elevation.buttonPressed.offsetY; // 1 px left showing while pressed
const DISABLED_OPACITY = 0.45;

/**
 * Prototype B `.btn`: a pill-ish button sitting on a solid shade that it presses into.
 * The shade is a separate layer offset below the face (not a box-shadow), so pressing only animates
 * the face's translateY and works the same on web and native.
 */
export default function Button({ label, onPress, variant = 'primary', disabled = false, loading = false, tone = 'primary', flex = false }: Props) {
  const ghost = variant === 'secondary';
  const depth = ghost ? GHOST_DEPTH : PRIMARY_DEPTH;
  const blocked = disabled || loading;
  const face = ghost ? color.surface : tones[tone].face;
  const shade = ghost ? color.border : tones[tone].shade;
  const labelColor = ghost ? color.text : color.onPrimary;

  const y = useSharedValue(0);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const press = (to: number) => () => {
    if (!blocked) y.value = withTiming(to, timing(motion.duration.fast, easing.pop));
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: blocked, busy: loading }}
      disabled={blocked}
      onPress={() => {
        if (!blocked) onPress();
      }}
      onPressIn={press(depth - PRESSED_DEPTH)}
      onPressOut={press(0)}
      style={[flex && styles.flex, disabled && styles.disabled]}
    >
      <View style={[styles.shade, { top: depth, bottom: -depth, backgroundColor: shade }]} />
      <Animated.View style={[styles.face, ghost && styles.ghost, { backgroundColor: face }, pressStyle]}>
        {loading ? <Spinner tint={labelColor} /> : null}
        <AppText role="button" style={[styles.label, { color: labelColor }]} numberOfLines={1}>
          {label}
        </AppText>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  disabled: { opacity: DISABLED_OPACITY },
  shade: { position: 'absolute', left: 0, right: 0, borderRadius: radius.lg },
  face: {
    flexGrow: 1, // fills the pressable when a row stretches it, so the shade stays aligned
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    paddingVertical: space[3.5],
    paddingHorizontal: space[4.5],
    borderRadius: radius.lg,
  },
  // As in the prototype the border adds to the box; in a row the primary button stretches to match.
  ghost: { borderWidth: 1, borderColor: color.border },
  label: { textAlign: 'center', flexShrink: 1 },
});
