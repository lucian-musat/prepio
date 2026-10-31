import { Easing, ReduceMotion, withDelay, withTiming } from 'react-native-reanimated';
import type { EntryExitAnimationFunction } from 'react-native-reanimated';
import { motion } from '@prepio/shared';

const { duration: dur, easing: curves } = motion;

export const easing = {
  standard: Easing.bezier(...curves.standard),
  pop: Easing.bezier(...curves.pop),
  shake: Easing.bezier(...curves.shake),
  out: Easing.bezier(...curves.out),
};

/** withTiming config that always honours the OS reduce-motion setting. */
export function timing(duration: number, curve: typeof easing.standard = easing.standard) {
  return { duration, easing: curve, reduceMotion: ReduceMotion.System };
}

type Direction = 'forward' | 'back';
type CardDirection = 'next' | 'prev';

// Plain config factories: the presets below are built from them, and tests assert on them.
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

export const cardInConfig = (direction: CardDirection) => ({
  duration: dur.base,
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

/** Fade + rise for list items; each index starts 50 ms after the previous one. */
export function enterStagger(index: number): EntryExitAnimationFunction {
  const c = staggerConfig(index);
  const cfg = timing(c.duration, easing.out);
  return () => {
    'worklet';
    return {
      initialValues: { opacity: 0, transform: [{ translateY: c.translateY }] },
      animations: {
        opacity: withDelay(c.delay, withTiming(1, cfg), c.reduceMotion),
        transform: [{ translateY: withDelay(c.delay, withTiming(0, cfg), c.reduceMotion) }],
      },
    };
  };
}

/** Screen transition: fade + slide in from the right (forward) or left (back). */
export function enterScreen(direction: Direction): EntryExitAnimationFunction {
  const c = screenConfig(direction);
  const cfg = timing(c.duration, easing.out);
  return () => {
    'worklet';
    return {
      initialValues: { opacity: 0, transform: [{ translateX: c.translateX }] },
      animations: { opacity: withTiming(1, cfg), transform: [{ translateX: withTiming(0, cfg) }] },
    };
  };
}

/** Card entering from the side with a slight tilt. */
export function cardIn(direction: CardDirection): EntryExitAnimationFunction {
  const c = cardInConfig(direction);
  const cfg = timing(c.duration);
  return () => {
    'worklet';
    return {
      initialValues: { opacity: 0, transform: [{ translateX: c.translateX }, { rotate: `${c.rotate}deg` }] },
      animations: {
        opacity: withTiming(1, cfg),
        transform: [{ translateX: withTiming(0, cfg) }, { rotate: withTiming('0deg', cfg) }],
      },
    };
  };
}

/** Card leaving to the opposite side, slightly shrunk. */
export function cardOut(direction: CardDirection): EntryExitAnimationFunction {
  const c = cardOutConfig(direction);
  const cfg = timing(c.duration);
  return () => {
    'worklet';
    return {
      initialValues: { opacity: 1, transform: [{ translateX: 0 }, { scale: 1 }] },
      animations: {
        opacity: withTiming(0, cfg),
        transform: [{ translateX: withTiming(c.translateX, cfg) }, { scale: withTiming(c.scale, cfg) }],
      },
    };
  };
}
