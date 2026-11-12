import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { GestureDetector, PointerType, usePanGesture, type PanGestureConfig } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { color, motion, radius, space, type Card } from '@prepio/shared';
import { Button, CardTransition, ScreenLayout, TextButton, easing, timing } from '../ui';
import CardView from './cards/CardView';
import type { LessonFrame } from './QuestionView';
import { swipeOffset, swipeTarget, swipeTilt } from './swipeMath';

// Prototype `.dots i` / `.dots i.on`.
const DOT = 7;
const DOT_ACTIVE = 22;

// The pan only starts on a clearly horizontal move and gives way to vertical scrolling.
const ACTIVE_X = 15;
const FAIL_Y = 12;

function Dot({ active }: { active: boolean }) {
  const width = useSharedValue(active ? DOT_ACTIVE : DOT);
  const bg = useSharedValue<string>(active ? color.primary : color.border);
  useEffect(() => {
    const t = timing(motion.duration.base);
    width.value = withTiming(active ? DOT_ACTIVE : DOT, t);
    bg.value = withTiming(active ? color.primary : color.border, t);
  }, [active]);
  const style = useAnimatedStyle(() => ({ width: width.value, backgroundColor: bg.value }));
  return <Animated.View style={[styles.dot, style]} />;
}

/** Swiping is for touch: always on native; on web only on touch-first screens, so mouse drags still select text. */
function touchScreen(): boolean {
  if (Platform.OS !== 'web') return true;
  return typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
}

type Props = {
  cards: Card[];
  onFinish: () => void;
  frame: LessonFrame;
  /** Label of the button on the last card, e.g. "La verificare" when the questions follow. */
  finishLabel?: string;
  /** Reports the current card so the lesson can update its progress bar. */
  onIndexChange?: (index: number) => void;
  /** Card to open on (a resumed lesson); default the first. */
  initialIndex?: number;
  /** Shown as a quiet link under the navigation: go straight to the test. */
  onSkip?: () => void;
  skipLabel?: string;
};

/**
 * Learning cards one at a time (prototype `.stepper`): slide transition, dots, Înapoi / Continuă in the action bar.
 * On touch screens the card can also be swiped (left = next, right = previous); the buttons stay the primary,
 * accessible path, and only the button finishes the lesson.
 */
export default function CardStepper({
  cards,
  onFinish,
  frame,
  finishLabel = 'Continuă',
  onIndexChange,
  initialIndex = 0,
  onSkip,
  skipLabel = 'Sari la verificare',
}: Props) {
  const [index, setIndex] = useState(initialIndex);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  // The last change came from a swipe: the old card already flew off, so CardTransition skips its exit.
  const [swiped, setSwiped] = useState(false);
  const [swipeEnabled] = useState(touchScreen);
  const reduced = useReducedMotion();
  const scrollRef = useRef<Animated.ScrollView>(null);

  // Drag state lives on the UI thread: offset under the finger, card width, bounds, and the fly-off in progress.
  const dx = useSharedValue(0);
  const width = useSharedValue(0);
  const canPrev = useSharedValue(index > 0);
  const canNext = useSharedValue(index < cards.length - 1);
  const flying = useSharedValue(false);
  const ignored = useSharedValue(false);
  // Finger travel at activation (past the ±15 px dead zone): subtracted so the card doesn't jump on pickup.
  const startX = useSharedValue(0);

  const card = cards[index];
  const last = index === cards.length - 1;

  useEffect(() => {
    canPrev.value = index > 0;
    canNext.value = index < cards.length - 1;
    // After a swipe the new card is in place (still hidden at the fly-off offset): bring the wrapper back.
    if (flying.value) {
      flying.value = false;
      dx.value = 0;
    }
  }, [index, cards.length, canPrev, canNext, flying, dx]);

  const go = (to: number, viaSwipe = false) => {
    setSwiped(viaSwipe);
    setDirection(to > index ? 'next' : 'prev');
    setIndex(to);
    onIndexChange?.(to);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };
  // Stable entry point for the gesture worklets, always calling the latest render's `go` (current index).
  const latest = useRef({ go, index });
  latest.current = { go, index };
  const onSwipe = useRef((target: 'next' | 'prev') => {
    const { go: goTo, index: from } = latest.current;
    goTo(target === 'next' ? from + 1 : from - 1, true);
  }).current;

  const pan = usePanGesture({
    enabled: swipeEnabled,
    activeOffsetX: [-ACTIVE_X, ACTIVE_X],
    failOffsetY: [-FAIL_Y, FAIL_Y],
    onBegin: (e) => {
      'worklet';
      // A mouse on a touch-first web screen keeps its usual drag (text selection).
      ignored.value = e.pointerType === PointerType.MOUSE || flying.value;
      startX.value = 0;
    },
    onActivate: (e) => {
      'worklet';
      startX.value = e.translationX;
    },
    onUpdate: (e) => {
      'worklet';
      if (ignored.value || reduced) return;
      dx.value = swipeOffset(e.translationX - startX.value, width.value, { canPrev: canPrev.value, canNext: canNext.value });
    },
    onDeactivate: (e) => {
      'worklet';
      if (ignored.value) return;
      // Cancelled or failed (system gesture, a scroll view took over): never navigate, just settle back.
      const target = e.canceled ? null : swipeTarget(e.translationX, e.velocityX, width.value, { canPrev: canPrev.value, canNext: canNext.value });
      if (!target) {
        dx.value = withTiming(0, timing(motion.duration.base, easing.out));
        return;
      }
      if (reduced) {
        scheduleOnRN(onSwipe, target);
        return;
      }
      // The card keeps going the way it was thrown and fades, then the stepper moves on; the next card tilts in
      // from the other side exactly like after a button press.
      flying.value = true;
      const off = (target === 'next' ? -1 : 1) * (width.value || Math.abs(dx.value) * 2);
      dx.value = withTiming(off, timing(motion.duration.fast, easing.out), (finished) => {
        if (finished) scheduleOnRN(onSwipe, target);
      });
    },
    // Also in the gesture config (web only): every config update resets the web handler, which drops the
    // detector's touchAction back to 'none' and blocks vertical touch scrolling. Whitelisted, not in the public type.
    touchAction: Platform.OS === 'web' ? 'pan-y' : undefined,
    userSelect: Platform.OS === 'web' ? 'auto' : undefined,
  } as PanGestureConfig);

  const drag = useAnimatedStyle(() => {
    const w = width.value;
    return {
      opacity: w > 0 && flying.value ? 1 - Math.min(1, Math.abs(dx.value) / w) : 1,
      transform: [{ translateX: dx.value }, { rotate: `${swipeTilt(dx.value, w)}deg` }],
    };
  });

  if (!card) return null;

  return (
    <ScreenLayout
      title={frame.title}
      progress={frame.progress}
      onBack={frame.onBack}
      scrollRef={scrollRef}
      actions={
        <View style={styles.actions}>
          <View style={styles.nav}>
            <Button
              flex
              variant="secondary"
              label="Înapoi"
              accessibilityLabel="Înapoi la cardul anterior"
              disabled={index === 0}
              onPress={() => index > 0 && go(index - 1)}
            />
            <Button flex label={last ? finishLabel : 'Continuă'} onPress={() => (last ? onFinish() : go(index + 1))} />
          </View>
          {onSkip ? <TextButton label={skipLabel} onPress={onSkip} /> : null}
        </View>
      }
    >
      {/* pan-y: the browser keeps vertical scrolling; userSelect auto: text stays selectable. */}
      <GestureDetector gesture={pan} touchAction="pan-y" userSelect="auto">
        <Animated.View testID="card-swipe" style={drag} onLayout={(e) => (width.value = e.nativeEvent.layout.width)}>
          <CardTransition contentKey={card.id} direction={direction} exit={!swiped}>
            <CardView card={card} eyebrow={`Card ${index + 1} din ${cards.length}`} />
          </CardTransition>
        </Animated.View>
      </GestureDetector>
      <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {cards.map((c, i) => (
          <Dot key={c.id} active={i === index} />
        ))}
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', justifyContent: 'center', gap: space[1.5], marginTop: space[3.5] },
  dot: { height: DOT, borderRadius: radius.pill },
  // The action bar lays its children out in a row: the optional skip link sits under Înapoi / Continuă.
  actions: { flex: 1, gap: space[2.5] },
  nav: { flexDirection: 'row', gap: space[2.5] },
});
