import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  ReduceMotion,
} from 'react-native-reanimated';
import { color, motion, radius, space } from '@prepio/shared';
import { fontFamily } from '../theme/fonts';
import AppText from './AppText';
import Enter from './Enter';
import { easing } from './motion';

// Prototype `.skel` / `.thinking` keyframes.
const SHIMMER_MS = 1200; // `shimmer 1.2s linear infinite`: the 200 %-wide tile travels two tile widths
const LINE_HEIGHT = space[3]; // 12 px bars
const DOT = space[2]; // 8 px dots
const BLINK_MS = 1000; // `blink 1s infinite ease-in-out`
const BLINK_STAGGER = 150;
const BLINK_LOW = { opacity: 0.25, scale: 0.8 };
const CSS_EASE_IN_OUT = Easing.bezier(0.42, 0, 0.58, 1);
const slideUp = { duration: motion.duration.base, translateY: space[3.5] };

const shimmerColors = [color.surfaceMuted, color.border, color.surfaceMuted] as const;

function Line({ width }: { width: number }) {
  const reduced = useReducedMotion();
  const [w, setW] = useState(0);
  const x = useSharedValue(0);

  useEffect(() => {
    if (!w) return;
    if (reduced) {
      x.value = -w / 2; // still frame with the highlight in the middle
      return;
    }
    // The gradient tile is 2w wide and repeats; moving one tile per half-loop is the CSS
    // background-position 200% → -200% sweep.
    const linear = { easing: Easing.linear, reduceMotion: ReduceMotion.System };
    x.value = withRepeat(
      withSequence(withTiming(-2 * w, { ...linear, duration: 0 }), withTiming(0, { ...linear, duration: SHIMMER_MS / 2 })),
      -1,
      false,
    );
  }, [w, reduced]);

  const sweep = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View style={[styles.line, { width: `${width}%` }]} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w ? (
        <Animated.View style={[styles.sweep, { width: 4 * w }, sweep]}>
          {[0, 1].map((i) => (
            <LinearGradient key={i} colors={[...shimmerColors]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: 2 * w }} />
          ))}
        </Animated.View>
      ) : null}
    </View>
  );
}

function Dot({ index }: { index: number }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    p.value = withDelay(
      index * BLINK_STAGGER,
      withRepeat(withTiming(1, { duration: BLINK_MS / 2, easing: CSS_EASE_IN_OUT, reduceMotion: ReduceMotion.System }), -1, true),
    );
  }, [reduced]);
  const blink = useAnimatedStyle(() => ({
    opacity: BLINK_LOW.opacity + (1 - BLINK_LOW.opacity) * p.value,
    transform: [{ scale: BLINK_LOW.scale + (1 - BLINK_LOW.scale) * p.value }],
  }));
  return <Animated.View style={[styles.dot, blink]} />;
}

type Props = { lines: number[] /* widths in % */ };

/** "Evaluating" placeholder (prototype `.skel`): blinking dots + label, then shimmering bars. */
export default function Skeleton({ lines }: Props) {
  return (
    <Enter config={slideUp} curve={easing.standard} style={styles.box}>
      <View style={styles.thinking} accessibilityLiveRegion="polite">
        {[0, 1, 2].map((i) => (
          <Dot key={i} index={i} />
        ))}
        <AppText role="small" color="textMuted" style={styles.label}>
          Se evaluează răspunsul…
        </AppText>
      </View>
      {lines.map((width, i) => (
        <Line key={i} width={width} />
      ))}
    </Enter>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    padding: space[4.5],
    gap: space[2.5],
  },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: space[2.5] },
  dot: { width: DOT, height: DOT, borderRadius: radius.pill, backgroundColor: color.primary },
  label: { fontFamily: fontFamily.bodySemi },
  line: { height: LINE_HEIGHT, borderRadius: radius.pill, overflow: 'hidden', backgroundColor: color.surfaceMuted },
  sweep: { position: 'absolute', top: 0, bottom: 0, left: 0, flexDirection: 'row' },
});
