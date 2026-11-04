import { Platform, type ViewStyle } from 'react-native';
import { useEffect } from 'react';
import {
  Easing, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming,
} from 'react-native-reanimated';
import { motion } from '@prepio/shared';

const { duration: dur, easing: curves } = motion;

export const easing = {
  standard: Easing.bezier(...curves.standard),
  pop: Easing.bezier(...curves.pop),
  shake: Easing.bezier(...curves.shake),
  out: Easing.bezier(...curves.out),
};

/** withTiming config that always honours the OS reduce-motion setting. A worklet: gesture callbacks call it on the UI thread. */
export function timing(duration: number, curve: typeof easing.standard = easing.standard) {
  'worklet';
  return { duration, easing: curve, reduceMotion: ReduceMotion.System };
}

type Direction = 'forward' | 'back';
type CardDirection = 'next' | 'prev';

// Config factories shared by Enter / useEnter / CardTransition; tests assert on them.
export const staggerConfig = (index: number) => ({
  duration: dur.slow,
  delay: 40 + index * motion.stagger,
  translateY: 12,
  reduceMotion: ReduceMotion.System,
});

export const screenConfig = (direction: Direction) => ({
  duration: dur.slow,
  translateX: direction === 'forward' ? 32 : -32,
  reduceMotion: ReduceMotion.System,
});

export const feedbackConfig = {
  duration: dur.slow,
  translateY: 14,
  reduceMotion: ReduceMotion.System,
};

export const cardInConfig = (direction: CardDirection) => ({
  duration: dur.slow, // prototype `.lcard.in-next`: var(--dur-slow)
  translateX: direction === 'next' ? 60 : -60,
  rotate: direction === 'next' ? 2 : -2,
  reduceMotion: ReduceMotion.System,
});

export const cardOutConfig = (direction: CardDirection) => ({
  duration: dur.base,
  translateX: direction === 'next' ? -50 : 50,
  scale: 0.96,
  reduceMotion: ReduceMotion.System,
});

/**
 * Fade + slide in from an offset when the calling component mounts; returns an animated style.
 * To replay it, remount the component (give it a new `key`, e.g. via <Enter key=...>): the
 * shared value is created at the hidden pose, so the first frame of new content is never the
 * previous content's resting pose. With OS reduce-motion on, it starts at rest and never animates.
 *
 * Use this instead of a Keyframe `entering` for anything that stays in layout flow: on
 * react-native-web, Reanimated 4.7 pins Keyframe-entering elements to position:absolute with a
 * frozen size about 5x the duration after they start (cleanup in layoutReanimation/web).
 */
export function useEnter(
  c: { duration: number; delay?: number; translateX?: number; translateY?: number },
  curve: typeof easing.standard = easing.standard,
) {
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? 1 : 0);
  const { duration, delay = 0, translateX = 0, translateY = 0 } = c;
  useEffect(() => {
    if (!reduced) {
      const run = withTiming(1, timing(duration, curve));
      p.value = delay ? withDelay(delay, run) : run;
    }
    // Mount-only by design: replaying is done by remounting (new key), so later changes to the
    // config, curve or reduce-motion setting must not restart the animation mid-flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return useAnimatedStyle(() => ({
    opacity: p.value,
    transform: translateY ? [{ translateY: (1 - p.value) * translateY }] : [{ translateX: (1 - p.value) * translateX }],
  }));
}

/**
 * CSS transition for state-driven style changes on web (prototype: the raised edge shadow and the
 * action bar tint fade over var(--dur) with the standard curve). Native has no CSS transitions,
 * so there the change is immediate.
 */
export function webTransition(properties: string[], duration: number = dur.base): ViewStyle {
  if (Platform.OS !== 'web') return {};
  return {
    transitionProperty: properties.join(', '),
    transitionDuration: `${duration}ms`,
    transitionTimingFunction: `cubic-bezier(${curves.standard.join(', ')})`,
  } as unknown as ViewStyle;
}
