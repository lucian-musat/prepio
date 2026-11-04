import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { border, color, difficultyTone, elevation, motion, opacity, pressScale, radius, space } from '@prepio/shared';
import AppText from './AppText';
import { Icon } from './IconButton';
import { mixColors, solidShadow } from './elevation';
import { timing } from './motion';
import { type } from './typography';
import type { LessonState } from '../lib/lessonFlow';

type Props = { index: number; title: string; state?: LessonState; onPress: () => void };

// Prototype `.lesson .num` tile and the `.lesson:hover` / `:active` motion.
const TILE = space[10] + space[1]; // 44 px
const HOVER_LIFT = -2;
const HOVER_NUDGE = 3; // chevron slides right on hover
const HOVER_BORDER = mixColors(color.primary, color.border, 0.35);

// Number tiles alternate teal / yellow (prototype `.lesson:nth-child(2) .num`). The yellow text is
// the AA-safe accent text tone (the medium-difficulty colour).
const tiles = [
  { bg: color.primarySubtle, fg: color.primary },
  { bg: color.accentSubtle, fg: difficultyTone.medium.fg },
] as const;

/**
 * One lesson on Home (prototype B `.lesson`): number tile, title, chevron; lifts on hover, shrinks on press.
 * `state` adds the learning-mode look: finished (check tile), current (primary border), locked (dimmed, inert).
 */
export default function LessonListItem({ index, title, state = 'open', onPress }: Props) {
  const [hovered, setHovered] = useState(false);
  const lift = useSharedValue(0);
  const scale = useSharedValue(1);
  const nudge = useSharedValue(0);
  const tile = tiles[index % 2];
  const locked = state === 'locked';
  const caption = state === 'finished' ? 'Terminată' : state === 'current' ? 'Continuă' : null;

  // CSS: `:active` replaces the hover transform, so pressing drops the lift while it shrinks.
  const t = () => timing(motion.duration.base);
  const onHover = (on: boolean) => () => {
    if (locked) return;
    setHovered(on);
    lift.value = withTiming(on ? HOVER_LIFT : 0, t());
    nudge.value = withTiming(on ? HOVER_NUDGE : 0, t());
  };
  const onPressState = (pressed: boolean) => () => {
    if (locked) return;
    scale.value = withTiming(pressed ? pressScale.row : 1, t());
    lift.value = withTiming(pressed || !hovered ? 0 : HOVER_LIFT, t());
  };

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }, { scale: scale.value }] }));
  const goStyle = useAnimatedStyle(() => ({ transform: [{ translateX: nudge.value }] }));

  return (
    // Plain Pressable around an Animated.View (like Button / IconButton): on web an animated Pressable
    // re-applies its React style when its pressed state re-renders, wiping the animated transform.
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={locked ? `${title}, blocată` : title}
      accessibilityState={{ disabled: locked }}
      aria-disabled={locked}
      disabled={locked}
      onPress={locked ? undefined : onPress}
      onHoverIn={onHover(true)}
      onHoverOut={onHover(false)}
      onPressIn={onPressState(true)}
      onPressOut={onPressState(false)}
      style={[styles.hit, locked && styles.locked]}
    >
      <Animated.View testID="lesson-row" style={[styles.row, hovered && !locked && styles.rowHover, state === 'current' && styles.rowCurrent, rowStyle]}>
        {state === 'finished' ? (
          <View testID="lesson-check" style={[styles.tile, { backgroundColor: color.primary }]}>
            <Icon name="check" tint={color.onPrimary} />
          </View>
        ) : (
          <View style={[styles.tile, { backgroundColor: tile.bg }]}>
            <AppText style={[styles.num, { color: tile.fg }]}>{index + 1}</AppText>
          </View>
        )}
        <View style={styles.text}>
          <AppText role="bodyStrong">{title}</AppText>
          {caption ? (
            <AppText role="caption" color={state === 'current' ? 'primary' : 'textMuted'}>
              {caption}
            </AppText>
          ) : null}
        </View>
        {locked ? (
          <AppText>🔒</AppText>
        ) : (
          <Animated.View style={goStyle}>
            <Icon name="chevron-right" tint={hovered ? color.primary : color.textMuted} />
          </Animated.View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { flexGrow: 1 },
  row: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3.5],
    padding: space[3.5],
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: border.hairline,
    borderColor: color.border,
    boxShadow: solidShadow(elevation.card.offsetY, elevation.card.color),
  },
  rowHover: { borderColor: HOVER_BORDER },
  rowCurrent: { borderColor: color.primary },
  locked: { opacity: opacity.disabled },
  tile: { width: TILE, height: TILE, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  // Prototype `.num`: heading font 900 at 18 px, without the heading letter-spacing.
  num: { ...type('section'), letterSpacing: 0 },
  text: { flex: 1 },
});
