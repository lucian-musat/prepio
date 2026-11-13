import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { color, gradient, radius, space, typeScale } from '@prepio/shared';
import { lessonCount } from '../lib/lessonCount';
import { fontFamily } from '../theme/fonts';
import AppText from './AppText';
import Chip from './Chip';
import { withAlpha } from './elevation';
import { t } from '../texts/store';
import { type } from './typography';

type Props = {
  lessonCount: number;
  /** A returning student: one greeting line instead of the welcome title and text. */
  greeting?: string;
};

// Prototype `.hero` text opacities and `.hero .chip` background.
const LABEL_ALPHA = 0.85;
const BODY_ALPHA = 0.92;
const CHIP_ALPHA = 0.18;
const BODY_MAX_WIDTH = 420;

// Prototype `.hero::after`: 180 px circle at right -50 / top -60, white 14 %, `float 8s ease-in-out infinite`
// (halfway it sits at translate(-14px, 10px) scale(1.06)).
const CIRCLE = 180;
const CIRCLE_RIGHT = -50;
const CIRCLE_TOP = -60;
const CIRCLE_ALPHA = 0.14;
const FLOAT_HALF_MS = 4000;
const FLOAT_X = -14;
const FLOAT_Y = 10;
const FLOAT_SCALE = 0.06;
const easeInOut = Easing.bezier(0.42, 0, 0.58, 1); // CSS `ease-in-out`

/**
 * Start/end points that make expo-linear-gradient draw the CSS `linear-gradient(<angle>deg, …)` on a
 * w×h box: the CSS gradient line runs through the centre at that angle and ends where the
 * perpendiculars through the corners cross it. Works for native (points in box fractions) and web
 * (which turns the pixel-space direction back into the same CSS angle).
 */
function cssAnglePoints(angle: number, w: number, h: number) {
  const rad = (angle * Math.PI) / 180;
  const sx = Math.sin(rad);
  const cy = -Math.cos(rad);
  const half = (Math.abs(w * sx) + Math.abs(h * cy)) / 2;
  const dx = (sx * half) / w;
  const dy = (cy * half) / h;
  return { start: { x: 0.5 - dx, y: 0.5 - dy }, end: { x: 0.5 + dx, y: 0.5 + dy } };
}

/**
 * Home hero (prototype B `.hero`): gradient card with greeting, title, welcome text and lesson count. With `greeting`
 * (a returning student) it is compact: that line and the count, so the continue card stays above the fold.
 */
export default function Hero({ lessonCount: count, greeting }: Props) {
  const reduced = useReducedMotion();
  const welcome = t('home.hero.welcome');
  const [size, setSize] = useState({ w: 1, h: 1 });
  const float = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    const half = (to: number) =>
      withTiming(to, { duration: FLOAT_HALF_MS, easing: easeInOut, reduceMotion: ReduceMotion.System });
    float.value = withRepeat(withSequence(half(1), half(0)), -1);
    return () => cancelAnimation(float);
  }, [reduced, float]);

  const circleStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: float.value * FLOAT_X },
      { translateY: float.value * FLOAT_Y },
      { scale: 1 + float.value * FLOAT_SCALE },
    ],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width && height && (width !== size.w || height !== size.h)) setSize({ w: width, h: height });
  };

  const points = cssAnglePoints(gradient.hero.angle, size.w, size.h);

  return (
    <LinearGradient
      testID="hero"
      colors={[...gradient.hero.colors]}
      locations={[...gradient.hero.locations]}
      start={points.start}
      end={points.end}
      onLayout={onLayout}
      style={[styles.hero, greeting ? styles.compact : null]}
    >
      {greeting ? (
        <AppText role="title" accessibilityRole="header" style={styles.greeting}>
          {greeting}
        </AppText>
      ) : (
        <>
          <AppText style={styles.label}>Bine ai venit!</AppText>
          <AppText role="display" accessibilityRole="header" style={styles.title}>
            Pregătește BAC-ul, pas cu pas.
          </AppText>
          {welcome ? (
            <AppText testID="hero-welcome" role="small" style={styles.body}>
              {welcome}
            </AppText>
          ) : null}
        </>
      )}
      <View style={greeting ? styles.chipCompact : styles.chip}>
        <Chip label={`📚 ${lessonCount(count)}`} fg={color.onPrimary} bg={withAlpha(color.onPrimary, CHIP_ALPHA)} />
      </View>
      {/* Last child, like `::after`: it floats over the text too. */}
      <Animated.View testID="hero-circle" pointerEvents="none" style={[styles.circle, circleStyle]} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: radius.xl,
    padding: space[5],
    marginTop: space[1],
    marginBottom: space[5.5],
    overflow: 'hidden',
  },
  // The prototype's <small> sits in a line box set by the 16 px body font (~22 px tall), which is
  // what spaces the title 6 px below it.
  label: {
    ...type('caption'),
    fontFamily: fontFamily.bodySemi,
    lineHeight: typeScale.lead.lineHeight,
    color: withAlpha(color.onPrimary, LABEL_ALPHA),
  },
  title: { color: color.onPrimary, marginTop: space[1.5], marginBottom: space[2] },
  body: { color: withAlpha(color.onPrimary, BODY_ALPHA), maxWidth: BODY_MAX_WIDTH },
  chip: { marginTop: space[3.5] },
  compact: { paddingVertical: space[4], marginBottom: space[4] },
  greeting: { color: color.onPrimary },
  chipCompact: { marginTop: space[2] },
  circle: {
    position: 'absolute',
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    right: CIRCLE_RIGHT,
    top: CIRCLE_TOP,
    backgroundColor: withAlpha(color.onPrimary, CIRCLE_ALPHA),
  },
});
