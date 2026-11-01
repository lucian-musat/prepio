import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { color, gradient, motion, radius, space } from '@prepio/shared';
import { easing, timing } from './motion';

type Props = { value: number; accessibilityLabel?: string };

const clamp = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));

// CSS angle (0deg = up, 90deg = right) → expo-linear-gradient start/end points.
function points(angle: number) {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.sin(rad) / 2;
  const dy = -Math.cos(rad) / 2;
  return { start: { x: 0.5 - dx, y: 0.5 - dy }, end: { x: 0.5 + dx, y: 0.5 + dy } };
}

const fill = points(gradient.progress.angle);
const INNER_SHADOW = 'inset 0px -3px 0px rgba(0, 0, 0, 0.08)';

/** Lesson progress: pill track with a gradient fill whose width eases to the new value. */
export default function ProgressBar({ value, accessibilityLabel }: Props) {
  const v = clamp(value);
  const now = Math.round(v * 100);
  const width = useSharedValue(v);

  useEffect(() => {
    width.value = withTiming(v, timing(motion.duration.slow, easing.standard));
  }, [v, width]);

  const animated = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));

  return (
    <View
      style={styles.track}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now }}
      // react-native-web 0.21 ignores accessibilityValue; the aria props reach the DOM.
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={now}
    >
      <Animated.View style={[styles.fill, animated]}>
        <LinearGradient colors={[...gradient.progress.colors]} start={fill.start} end={fill.end} style={StyleSheet.absoluteFill} />
        {/* Overlay so the inset shadow paints above the gradient (inset shadows sit under children). */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.shade]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: space[3],
    borderRadius: radius.pill,
    backgroundColor: color.surfaceMuted,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill, overflow: 'hidden' },
  shade: { borderRadius: radius.pill, boxShadow: INNER_SHADOW },
});
