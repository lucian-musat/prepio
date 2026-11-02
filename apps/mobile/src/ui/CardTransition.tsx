import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { motion } from '@prepio/shared';
import { cardInConfig, cardOutConfig, easing, timing } from './motion';

type Direction = 'next' | 'prev';
type Key = string | number;

type Props = {
  /** Identity of the current card; a change plays the transition. */
  contentKey: Key;
  /** 'next' slides the new card in from the right, 'prev' from the left. */
  direction: Direction;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

// Incoming card: fades in from ±60 px with a ±2° tilt (cardInConfig), in normal layout flow.
function Incoming({ direction, animate, onLayout, children }: { direction: Direction; animate: boolean; onLayout: (e: LayoutChangeEvent) => void; children: ReactNode }) {
  const c = cardInConfig(direction);
  const p = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (animate) p.value = withTiming(1, timing(c.duration, easing.standard));
  }, [animate, c.duration, p]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, p.value),
    transform: [{ translateX: (1 - p.value) * c.translateX }, { rotate: `${(1 - p.value) * c.rotate}deg` }],
  }));
  return (
    <Animated.View testID="card-in" style={[styles.incoming, style]} onLayout={onLayout}>
      {children}
    </Animated.View>
  );
}

// Outgoing card: overlaid at the top, drifts ∓50 px, shrinks to .96 and fades (cardOutConfig).
function Outgoing({ direction, children }: { direction: Direction; children: ReactNode }) {
  const c = cardOutConfig(direction);
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, timing(c.duration, easing.standard));
  }, [c.duration, p]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - p.value),
    transform: [{ translateX: p.value * c.translateX }, { scale: 1 + p.value * (c.scale - 1) }],
  }));
  // Leaving: out of the accessibility tree (native + web) and untouchable (pointerEvents in style).
  return (
    <Animated.View
      testID="card-out"
      style={[styles.outgoing, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    >
      {children}
    </Animated.View>
  );
}

/**
 * Card stepper transition built on shared values (Keyframe `entering`/`exiting` break in-flow
 * layout on web, ruling R8). The incoming card stays in flow, so the container sizes to it; the
 * outgoing card is overlaid absolutely until it has faded. Like the prototype `.stepper`, the
 * container's min-height eases from the old card's height to the new one, so a shorter card
 * doesn't make the page jump. With OS reduce motion the new card simply replaces the old one.
 */
export default function CardTransition({ contentKey, direction, style, children }: Props) {
  const reduced = useReducedMotion();
  const [shownKey, setShownKey] = useState<Key>(contentKey);
  const [outgoing, setOutgoing] = useState<{ key: Key; children: ReactNode; direction: Direction } | null>(null);
  const [animateIn, setAnimateIn] = useState(false);
  // Last committed card (key + children), written only in the layout effect below.
  const committed = useRef<{ key: Key; children: ReactNode }>({ key: contentKey, children });
  const height = useRef(0);
  const minHeight = useSharedValue(0);

  // Key changed: the new card mounts animated (derived state from state, not refs: React re-renders
  // right away, before committing).
  if (shownKey !== contentKey) {
    setShownKey(contentKey);
    setAnimateIn(!reduced);
  }

  // After each commit of new children, before paint: on a key change keep the previous card around to animate it
  // out, and hold its height (the new card's onLayout hasn't run yet), then onLayout eases to the new one.
  useLayoutEffect(() => {
    const previous = committed.current;
    committed.current = { key: contentKey, children };
    if (previous.key === contentKey || reduced) return;
    setOutgoing({ key: previous.key, children: previous.children, direction });
    minHeight.value = height.current;
  }, [contentKey, children, reduced, direction, minHeight]);

  useEffect(() => {
    if (!outgoing) return;
    const t = setTimeout(() => setOutgoing(null), cardOutConfig(outgoing.direction).duration);
    return () => clearTimeout(t);
  }, [outgoing]);

  const onLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    height.current = h;
    minHeight.value = reduced || !outgoing ? h : withTiming(h, timing(motion.duration.base, easing.standard));
  };

  const box = useAnimatedStyle(() => ({ minHeight: minHeight.value }));

  return (
    <Animated.View testID="card-box" style={[styles.box, style, box]}>
      {outgoing ? (
        <Outgoing key={`out-${outgoing.key}`} direction={outgoing.direction}>
          {outgoing.children}
        </Outgoing>
      ) : null}
      <Incoming key={contentKey} direction={direction} animate={animateIn && !reduced} onLayout={onLayout}>
        {children}
      </Incoming>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'relative' },
  // Above the outgoing card (positioned elements paint over in-flow ones on web).
  incoming: { position: 'relative', zIndex: 1 },
  outgoing: { position: 'absolute', top: 0, left: 0, right: 0, pointerEvents: 'none' },
});
