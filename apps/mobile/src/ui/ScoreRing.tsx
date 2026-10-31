import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { color } from '@prepio/shared';
import AppText from './AppText';
import { easing, timing } from './motion';

// Prototype `.ring`: 76 px, r 32, stroke 8, arc fills over 1.1 s.
const DEFAULT_SIZE = 76;
const R = 32;
const STROKE = 8;
const CIRCUMFERENCE = 2 * Math.PI * R;
const FILL_MS = 1100;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = { value: number; min: number; max: number; size?: number };

const fraction = (value: number, min: number, max: number) => (max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 1);

/** Grade ring: the arc and the number count up from `min` to `value` on mount (instantly with reduce motion). */
export default function ScoreRing({ value, min, max, size = DEFAULT_SIZE }: Props) {
  const reduced = useReducedMotion();
  const target = fraction(value, min, max);
  const fill = useSharedValue(reduced ? target : 0);
  const [shown, setShown] = useState(reduced ? value : min);

  useEffect(() => {
    if (reduced) {
      fill.value = target;
      setShown(value);
      return;
    }
    fill.value = withTiming(target, timing(FILL_MS, easing.out));
    // The number counts on the JS side with a cubic ease-out (prototype `tick`).
    const from = shown;
    const start = Date.now();
    let frame = 0;
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / FILL_MS);
      setShown(Math.round(from + (value - from) * (1 - (1 - p) ** 3)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, min, max, reduced]);

  const arc = useAnimatedProps(() => ({ strokeDashoffset: CIRCUMFERENCE * (1 - fill.value) }));
  const centre = size / 2;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Nota ${value} din ${max}`}
      style={[styles.ring, { width: size, height: size }]}
    >
      <Svg width={size} height={size} style={styles.svg}>
        <Circle cx={centre} cy={centre} r={R} stroke={color.surfaceMuted} strokeWidth={STROKE} fill="none" />
        <AnimatedCircle
          cx={centre}
          cy={centre}
          r={R}
          stroke={color.primary}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          fill="none"
          animatedProps={arc}
        />
      </Svg>
      <View style={styles.centre}>
        <AppText role="display">{shown}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'relative', flexShrink: 0 },
  // Start the arc at 12 o'clock.
  svg: { transform: [{ rotate: '-90deg' }] },
  centre: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
