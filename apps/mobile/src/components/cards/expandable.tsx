import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { color, motion, pressScale, space } from '@prepio/shared';
import { AppText, Icon, easing, timing, webTransition } from '../../ui';

const HINT_ICON = space[4]; // 16 px glyph

/** One-line hint above a list whose items open for details (only rendered when some item can open). */
export function ExpandHint({ text }: { text: string }) {
  return (
    <View style={styles.hint}>
      <Icon name="info" size={HINT_ICON} tint={color.textMuted} />
      <AppText role="caption" color="textMuted" style={styles.hintText}>
        {text}
      </AppText>
    </View>
  );
}

/** Web: pointer cursor on the pressable (native has none). */
export const pointer: ViewStyle = Platform.OS === 'web' ? { cursor: 'pointer' } : {};
/** Web: the hover tint fades like a CSS transition (instant on native). */
export const hoverTransition: ViewStyle = webTransition(['background-color']);

/**
 * Feedback for an item that opens for details: press scale (as OptionRow), hover state for a web tint, and a
 * 0 → 1 progress following `open` for the chevron / badge turn. With reduce motion nothing animates.
 */
export function useExpandFeedback(open: boolean) {
  const reduced = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const scale = useSharedValue(1);
  const turn = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    turn.value = reduced ? (open ? 1 : 0) : withTiming(open ? 1 : 0, timing(motion.duration.base, easing.out));
  }, [open, reduced, turn]);

  const press = (to: number) => () => {
    if (!reduced) scale.value = withTiming(to, timing(motion.duration.fast));
  };
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return {
    hovered,
    turn,
    pressStyle,
    handlers: {
      onPressIn: press(pressScale.row),
      onPressOut: press(1),
      onHoverIn: () => setHovered(true),
      onHoverOut: () => setHovered(false),
    },
  };
}

const styles = StyleSheet.create({
  hint: { flexDirection: 'row', alignItems: 'center', gap: space[1.5], marginBottom: space[2.5] },
  hintText: { flexShrink: 1 },
});
