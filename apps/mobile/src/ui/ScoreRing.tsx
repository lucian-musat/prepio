import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { color, stroke } from '@prepio/shared';
import AppText from './AppText';
import { easing, timing } from './motion';
import { t } from '../texts/store';

// Prototype `.ring`: 76 px, r 32, stroke 8, arc fills over 1.1 s.
const DEFAULT_SIZE = 76;
const R = 32;
const CIRCUMFERENCE = 2 * Math.PI * R;
const FILL_MS = 1100;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  value: number;
  min: number;
  max: number;
  size?: number;
  /** Shows „7/9” instead of „7” (a count, not a grade). */
  showMax?: boolean;
  /** Accessible name; default „Nota <value> din <max>”. */
  label?: string;
};

export const fraction = (value: number, min: number, max: number) => (max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 1);

/** Grade ring: the arc and the number count up from `min` to `value` on mount (instantly with reduce motion). */
export default function ScoreRing({ value, min, max, size = DEFAULT_SIZE, showMax = false, label }: Props) {
  const reduced = useReducedMotion();
  const target = fraction(value, min, max);
  const fill = useSharedValue(reduced ? target : 0);
  const [shown, setShown] = useState(reduced ? value : min);
  // Last number shown, so a new value counts on from there (read in the effect, not a dependency).
  const latest = useRef(shown);

  useEffect(() => {
    if (reduced) {
      fill.value = target;
      latest.current = value;
      setShown(value);
      return;
    }
    fill.value = withTiming(target, timing(FILL_MS, easing.standard));
    // The number counts on the JS side with a cubic ease-out (prototype `tick`).
    const from = latest.current;
    const start = Date.now();
    let frame = 0;
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / FILL_MS);
      latest.current = Math.round(from + (value - from) * (1 - (1 - p) ** 3));
      setShown(latest.current);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, target, reduced, fill]);

  const arc = useAnimatedProps(() => ({ strokeDashoffset: CIRCUMFERENCE * (1 - fill.value) }));
  const centre = size / 2;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label ?? t('common.scoreRing.label', { nota: value, max })}
      style={[styles.ring, { width: size, height: size }]}
    >
      <Svg width={size} height={size} style={styles.svg}>
        <Circle cx={centre} cy={centre} r={R} stroke={color.surfaceMuted} strokeWidth={stroke.ring} fill="none" />
        <AnimatedCircle
          cx={centre}
          cy={centre}
          r={R}
          stroke={color.primary}
          strokeWidth={stroke.ring}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          fill="none"
          animatedProps={arc}
        />
      </Svg>
      <View style={styles.centre}>
        <AppText role="display" style={styles.number}>{showMax ? `${shown}/${max}` : shown}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'relative', flexShrink: 0 },
  // Start the arc at 12 o'clock.
  svg: { transform: [{ rotate: '-90deg' }] },
  centre: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  // Prototype `.ring b`: no heading letter-spacing.
  number: { letterSpacing: 0 },
});
