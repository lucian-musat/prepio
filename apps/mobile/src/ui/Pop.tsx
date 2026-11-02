import { useEffect, type ReactNode } from 'react';
import type { StyleProp, ViewProps, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { easing, timing } from './motion';

// Prototype `@keyframes pop`: scale .6 → 1.18 (at 60 %) → 1 with the pop curve.
export const POP = { from: 0.6, peak: 1.18, peakAt: 0.6 } as const;

/** The pop keyframes over `duration` ms as a Reanimated animation (jumps to `from` first). */
export function popSequence(duration: number) {
  return withSequence(
    withTiming(POP.from, { duration: 0 }),
    withTiming(POP.peak, timing(duration * POP.peakAt, easing.pop)),
    withTiming(1, timing(duration * (1 - POP.peakAt), easing.pop)),
  );
}

type Props = Omit<ViewProps, 'style'> & {
  /** Length of the whole pop in ms. */
  duration: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

/** View that pops in once on mount; with OS reduce motion it renders at rest and never animates. */
export default function Pop({ duration, style, children, ...rest }: Props) {
  const reduced = useReducedMotion();
  const scale = useSharedValue<number>(reduced ? 1 : POP.from);
  useEffect(() => {
    if (!reduced) scale.value = popSequence(duration);
    // Mount-only by design (like useEnter): replay by remounting. `reduced`/`duration` are read once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View testID="pop" {...rest} style={[style, pop]}>
      {children}
    </Animated.View>
  );
}
