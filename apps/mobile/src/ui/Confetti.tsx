import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { color, space } from '@prepio/shared';

// Prototype `confetti()` / `.confetti i` / `@keyframes burst`.
const COUNT = 28;
const PIECE_W = space[2]; // 8 px
const PIECE_H = space[3]; // 12 px
const PIECE_RADIUS = 2;
const BURST_MS = 900;
const BURST_EASING = Easing.bezier(0.15, 0.7, 0.3, 1);
const MAX_DELAY_MS = 80;
const LIFETIME_MS = 1200; // the prototype removes the box after 1.2 s
const DISTANCE = { min: 90, spread: 120 };
const LIFT = 60; // pieces fly slightly upwards overall
const SPIN_DEG = 360;
const ORIGIN_TOP = '40%';
const colors = [color.primary, color.accent, color.success, color.onPrimary];

type Piece = { x: number; y: number; r: number; delay: number; tint: string };

function makePieces(): Piece[] {
  return Array.from({ length: COUNT }, (_, k) => {
    const a = Math.random() * Math.PI * 2;
    const d = DISTANCE.min + Math.random() * DISTANCE.spread;
    return {
      x: Math.cos(a) * d,
      y: Math.sin(a) * d - LIFT,
      r: Math.random() * 2 * SPIN_DEG - SPIN_DEG,
      delay: Math.random() * MAX_DELAY_MS,
      tint: colors[k % colors.length],
    };
  });
}

function PieceView({ piece }: { piece: Piece }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(piece.delay, withTiming(1, { duration: BURST_MS, easing: BURST_EASING, reduceMotion: ReduceMotion.System }));
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - p.value,
    transform: [{ translateX: piece.x * p.value }, { translateY: piece.y * p.value }, { rotate: `${piece.r * p.value}deg` }],
  }));
  return <Animated.View style={[styles.piece, { backgroundColor: piece.tint }, style]} />;
}

function Burst() {
  const pieces = useMemo(makePieces, []);
  return (
    <>
      {pieces.map((piece, i) => (
        <PieceView key={i} piece={piece} />
      ))}
    </>
  );
}

/**
 * Celebration burst over the nearest positioned ancestor. Bursts each time `trigger` changes to a
 * new positive value; renders nothing with OS reduce motion on.
 */
export default function Confetti({ trigger }: { trigger: number }) {
  const reduced = useReducedMotion();
  const [live, setLive] = useState(0);

  useEffect(() => {
    if (!trigger || reduced) return;
    setLive(trigger);
    const t = setTimeout(() => setLive(0), LIFETIME_MS);
    return () => clearTimeout(t);
  }, [trigger, reduced]);

  if (reduced || !live) return null;
  return (
    // pointerEvents lives in style: the prop form is deprecated on react-native-web.
    <View style={styles.box} testID="confetti">
      <Burst key={live} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { ...StyleSheet.absoluteFill, overflow: 'hidden', zIndex: 5, pointerEvents: 'none' },
  piece: {
    position: 'absolute',
    top: ORIGIN_TOP,
    left: '50%',
    width: PIECE_W,
    height: PIECE_H,
    borderRadius: PIECE_RADIUS,
  },
});
