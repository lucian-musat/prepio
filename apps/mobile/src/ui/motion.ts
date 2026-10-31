import { useEffect } from 'react';
import { Easing, Keyframe, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
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

export const feedbackConfig = {
  duration: dur.slow,
  translateY: 14,
  reduceMotion: ReduceMotion.System,
};

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

// Reanimated on web only supports predefined builders and Keyframe (no custom worklet
// animations), and a Keyframe step can't carry a custom bezier there. So the token curve is
// baked into evenly spaced linear steps, which renders the same curve on web and native.
const STEPS = 10;

function cubicBezierY([x1, y1, x2, y2]: readonly number[], x: number): number {
  const axis = (a: number, b: number, t: number) => 3 * a * (1 - t) ** 2 * t + 3 * b * (1 - t) * t ** 2 + t ** 3;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (axis(x1, x2, mid) < x) lo = mid;
    else hi = mid;
  }
  return axis(y1, y2, (lo + hi) / 2);
}

type Pose = { opacity: number; translateX?: number; translateY?: number; rotate?: number; scale?: number };

function pose(p: Pose) {
  const transform: Record<string, number | string>[] = [];
  if (p.translateX !== undefined) transform.push({ translateX: p.translateX });
  if (p.translateY !== undefined) transform.push({ translateY: p.translateY });
  if (p.rotate !== undefined) transform.push({ rotate: `${p.rotate}deg` });
  if (p.scale !== undefined) transform.push({ scale: p.scale });
  return { opacity: p.opacity, transform };
}

function bake(
  from: Pose,
  to: Pose,
  curve: readonly number[],
  c: { duration: number; delay?: number; reduceMotion: ReduceMotion },
) {
  const mix = (a: number | undefined, b: number | undefined, t: number) =>
    a === undefined || b === undefined ? undefined : a + (b - a) * t;
  const definitions: Record<string, ReturnType<typeof pose>> = { from: pose(from) };
  for (let i = 1; i <= STEPS; i++) {
    const t = cubicBezierY(curve, i / STEPS);
    const at = (k: keyof Pose) => mix(from[k], to[k], t);
    definitions[i === STEPS ? 'to' : String((i * 100) / STEPS)] = pose({
      opacity: Math.min(1, Math.max(0, at('opacity') ?? 0)),
      translateX: at('translateX'),
      translateY: at('translateY'),
      rotate: at('rotate'),
      scale: at('scale'),
    });
  }
  const k = new Keyframe(definitions as never).duration(c.duration).reduceMotion(c.reduceMotion);
  return c.delay ? k.delay(c.delay) : k;
}

/** Fade + rise for list items; each index starts 50 ms after the previous one. */
export function enterStagger(index: number) {
  const c = staggerConfig(index);
  return bake({ opacity: 0, translateY: c.translateY }, { opacity: 1, translateY: 0 }, curves.out, c);
}

/** Screen transition: fade + slide in from the right (forward) or left (back). */
export function enterScreen(direction: Direction) {
  const c = screenConfig(direction);
  return bake({ opacity: 0, translateX: c.translateX }, { opacity: 1, translateX: 0 }, curves.out, c);
}

/** Card entering from the side with a slight tilt. */
export function cardIn(direction: CardDirection) {
  const c = cardInConfig(direction);
  return bake(
    { opacity: 0, translateX: c.translateX, rotate: c.rotate },
    { opacity: 1, translateX: 0, rotate: 0 },
    curves.standard,
    c,
  );
}

/** Card leaving to the opposite side, slightly shrunk. */
export function cardOut(direction: CardDirection) {
  const c = cardOutConfig(direction);
  return bake(
    { opacity: 1, translateX: 0, scale: 1 },
    { opacity: 0, translateX: c.translateX, scale: c.scale },
    curves.standard,
    c,
  );
}

/**
 * Fade + slide in from an offset, replayed whenever `key` changes; returns an animated style.
 * Use this instead of a Keyframe `entering` for anything that stays in layout flow: on
 * react-native-web, Reanimated 4.7 pins Keyframe-entering elements to position:absolute with a
 * frozen size about 5x the duration after they start (cleanup in layoutReanimation/web).
 */
export function useEnter(
  key: string | number | undefined,
  c: { duration: number; translateX?: number; translateY?: number },
  curve: typeof easing.standard = easing.out,
) {
  const p = useSharedValue(0);
  const { duration, translateX = 0, translateY = 0 } = c;
  useEffect(() => {
    p.value = 0;
    p.value = withTiming(1, timing(duration, curve));
  }, [key, p, duration, curve]);
  return useAnimatedStyle(() => ({
    opacity: p.value,
    transform: translateY ? [{ translateY: (1 - p.value) * translateY }] : [{ translateX: (1 - p.value) * translateX }],
  }));
}
