import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { border, color, creditsLabel, elevation, feedbackText, motion, opacity, radius, space } from '@prepio/shared';
import AppText from './AppText';
import { Icon, type IconName } from './IconButton';
import Spinner from './Spinner';
import { type } from './typography';
import { easing, timing, webTransition } from './motion';
import Coin from '../credits/Coin';

type Props = {
  /** The visible text; an icon-only button leaves it out and needs an accessibilityLabel. */
  label?: string;
  /** Accessible name when the visible label is ambiguous on its screen (defaults to label). */
  accessibilityLabel?: string;
  /** A glyph in the label's colour, before the label. */
  icon?: IconName;
  /** Narrower side padding, for a secondary action sharing a row on a phone (icon-only buttons always are). */
  compact?: boolean;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  tone?: 'primary' | 'success' | 'danger';
  flex?: boolean;
  /** Credits the action costs: a coin pill after the label (hidden while loading). */
  cost?: number;
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
const PRESSED_DEPTH = elevation.buttonPressed.offsetY; // 1 px of primary shade left showing while pressed
// Prototype B `.btn:active { transform: translateY(3px) }` for both variants.
const PRESS_TRAVEL = PRIMARY_DEPTH - PRESSED_DEPTH;
// Applied on web only (native has no hover); checked at render so it follows Platform.OS.
const BRIGHTEN: ViewStyle = { filter: 'brightness(1.05)' };

/**
 * Prototype B `.btn`: a pill-ish button sitting on a solid shade that it presses into.
 * The shade is a separate layer offset below the face (not a box-shadow), so pressing animates only
 * translateY (the face; for the ghost also its shade) and works the same on web and native.
 */
export default function Button({
  label,
  accessibilityLabel,
  icon,
  compact = false,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  tone = 'primary',
  flex = false,
  cost,
}: Props) {
  const ghost = variant === 'secondary';
  const depth = ghost ? GHOST_DEPTH : PRIMARY_DEPTH;
  const blocked = disabled || loading;
  const [hovered, setHovered] = useState(false);
  const hover = hovered && !blocked;
  // Prototype hover: the ghost face turns surface-2; the primary face brightens 5 % (web only).
  const face = ghost ? (hover ? color.surfaceMuted : color.surface) : tones[tone].face;
  const shade = ghost ? color.border : tones[tone].shade;
  const labelColor = ghost ? color.text : color.onPrimary;
  // The glyph box is as tall as a label line, so an icon-only button lines up with its neighbours.
  const glyph = (
    <View testID="button-icon" style={styles.glyph}>
      <Icon name={icon!} tint={labelColor} />
    </View>
  );

  const base = accessibilityLabel ?? label;
  const name = cost !== undefined && base ? `${base}, costă ${creditsLabel(cost)}` : base;

  const y = useSharedValue(0);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const press = (to: number) => () => {
    if (!blocked) y.value = withTiming(to, timing(motion.duration.fast, easing.standard));
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityState={{ disabled: blocked, busy: loading }}
      disabled={blocked}
      onPress={() => {
        if (!blocked) onPress();
      }}
      onPressIn={press(PRESS_TRAVEL)}
      onPressOut={press(0)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[flex && styles.flex, disabled && styles.disabled]}
    >
      {/* Ghost: the prototype keeps its 3 px shade under the face while pressed, so both travel together. */}
      <Animated.View style={[styles.shade, { top: depth, bottom: -depth, backgroundColor: shade }, ghost && pressStyle]} />
      <Animated.View testID="button-face" style={[styles.face, (compact || !label) && styles.compact, ghost && styles.ghost, { backgroundColor: face }, hover && !ghost && Platform.OS === 'web' && BRIGHTEN, pressStyle]}>
        {loading ? <Spinner tint={labelColor} /> : null}
        {icon ? glyph : null}
        {label ? (
          <AppText role="button" style={[styles.label, { color: labelColor }]} numberOfLines={1}>
            {label}
          </AppText>
        ) : null}
        {cost !== undefined && !loading ? (
          <View testID="button-cost" style={styles.cost}>
            <Coin size={12} />
            <AppText role="label" style={[styles.costText, { color: labelColor }]}>
              {cost}
            </AppText>
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  disabled: { opacity: opacity.disabled },
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
    ...webTransition(['background-color']), // prototype `.btn` transitions background, not filter
  },
  // As in the prototype the border adds to the box; in a row the primary button stretches to match.
  ghost: { borderWidth: border.hairline, borderColor: color.border },
  label: { textAlign: 'center', flexShrink: 1 },
  compact: { paddingHorizontal: space[3] },
  glyph: { height: type('button').lineHeight, justifyContent: 'center' },
  // Mockup `.pill`: translucent white over the face.
  cost: { flexDirection: 'row', alignItems: 'center', gap: space[1], backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radius.pill, paddingVertical: 2, paddingHorizontal: space[2] },
  costText: { fontWeight: '700' },
});
