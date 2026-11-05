import { memo, useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Platform, StyleSheet, Text, View, type LayoutChangeEvent, type TextStyle } from 'react-native';
import {
  GestureDetector,
  GestureStateManager,
  PointerType,
  useExclusiveGestures,
  usePanGesture,
  useTapGesture,
  type PanGestureConfig,
  type TapGestureConfig,
} from 'react-native-gesture-handler';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { color, markerPen, tokenizeSource, typeScale, type ExerciseFeedback, type Source, type Verdict } from '@prepio/shared';
import { fontFamily } from '../../theme/fonts';
import type { MarkerAction, MarkerState, Pen } from './markerReducer';
import { wordAt, type WordBox } from './wordHit';

const LONG_PRESS_MS = 280; // touch: hold this long (without moving) before a drag starts
const MOUSE_SLOP = 6; // mouse: a drag starts on the first move beyond this many px
const HANDLE = 13; // visible handle dot
const HANDLE_SLOP = 12; // extra touch area around the dot, on every side
const UNDERLINE = 3;
const END_RADIUS = 5;
const PARAGRAPH_GAP = 14;
const BLINK_MS = 1000;
// Word text: the line height is the mark's height; `lineGap` above and below each word makes the line pitch
// (reader ~1.8 x 17 px as in the mockup, body ~1.6 x 17 px like `typeScale.body`).
const READING_TEXT = { size: 17, lineHeight: 24, lineGap: 3.5 };
const BODY_TEXT = { size: typeScale.body.size, lineHeight: 23, lineGap: 2 };
const HINT = 'Atinge primul și ultimul cuvânt al informației ca s-o marchezi.';

const PEN_LABEL: Record<Pen, string> = { info: 'Informație', cause: 'Cauză', effect: 'Efect', support: 'Informație-suport' };
const VERDICT_COLOR: Record<Verdict, string> = { ok: color.success, almost: color.accent, no: color.danger };

type Props = {
  source: Source;
  state: MarkerState;
  dispatch: (a: MarkerAction) => void;
  verdicts?: ExerciseFeedback['marks'];
  readOnly?: boolean;
  /** Reader typography (Literata), instead of the app's body text. */
  reading?: boolean;
};
type Point = { x: number; y: number };
type Rect = { x: number; y: number; width: number; height: number };

/**
 * A source text the student marks word by word. Words are individually measured elements; one pan and one tap
 * gesture on the whole text hit-test against their boxes (a single native Text can't be hit-tested on Android).
 * Touch: hold ~280 ms, then drag (a normal swipe keeps scrolling the parent). Mouse (web): drag straight away.
 * Tap-tap: first word, then last word. The active mark shows two handles that drag one end.
 */
export default function MarkableText({ source, state, dispatch, verdicts, readOnly = false, reading = false }: Props) {
  const web = Platform.OS === 'web';
  const words = useMemo(() => tokenizeSource(source.body).words, [source.body]);
  const paragraphs = useMemo(() => {
    const out: (typeof words)[] = [];
    for (const w of words) (out[w.paragraph] ??= []).push(w);
    return out;
  }, [words]);

  // Layouts (relative to their parent) are kept in refs: they change often and never need a render by themselves.
  const layout = useRef({ paragraphs: new Map<number, Point>(), words: new Map<number, Rect>(), inner: new Map<number, Rect>() });
  const boxOf = useCallback(
    (i: number): WordBox | null => {
      const w = words[i];
      const p = w && layout.current.paragraphs.get(w.paragraph);
      const b = layout.current.words.get(i);
      return p && b ? { i, x: p.x + b.x, y: p.y + b.y, width: b.width, height: b.height } : null;
    },
    [words],
  );
  const hit = useCallback(
    (x: number, y: number) =>
      wordAt(
        words.map((w) => boxOf(w.i)).filter((b): b is WordBox => b !== null),
        x,
        y,
      ),
    [words, boxOf],
  );
  // The root re-renders once after a resize, so handles follow the new word positions.
  const [, setLayoutTick] = useState(0);
  const onRootLayout = useCallback(() => requestAnimationFrame(() => setLayoutTick((t) => t + 1)), []);

  // Gesture callbacks are created once and read the latest props through this ref.
  const live = useRef({ dispatch, sourceId: source.id, hit });
  live.current = { dispatch, sourceId: source.id, hit };

  const dragging = useRef(false);
  const begin = useRef<{ x: number; y: number; touch: boolean } | null>(null);
  const press = useRef<{ x: number; y: number; mouse: boolean; timer?: ReturnType<typeof setTimeout> } | null>(null);
  const clearPress = () => {
    if (press.current?.timer) clearTimeout(press.current.timer);
    press.current = null;
  };

  const panConfig = useMemo(
    () =>
      ({
        runOnJS: true,
        enabled: !readOnly,
        // Native (touch): the gesture handler's own long-press activation; moving first fails it, so the parent
        // ScrollView scrolls. Web: manual activation decided per pointer type in the touch callbacks below.
        ...(web ? { manualActivation: true } : { activateAfterLongPress: LONG_PRESS_MS }),
        onBegin: (e: { x: number; y: number; pointerType: PointerType }) => {
          begin.current = { x: e.x, y: e.y, touch: e.pointerType !== PointerType.MOUSE };
        },
        onActivate: (e: { x: number; y: number }) => {
          const { dispatch: d, sourceId, hit: h } = live.current;
          const start = begin.current ?? { x: e.x, y: e.y, touch: true };
          const i = h(start.x, start.y);
          if (i === null) return;
          dragging.current = true;
          d({ type: 'dragStart', sourceId, i });
          const j = h(e.x, e.y);
          if (j !== null && j !== i) d({ type: 'dragMove', i: j });
          // No expo-haptics in the app (no new native module): the browser's vibration stands in on touch web.
          if (web && start.touch && typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(10);
        },
        onUpdate: (e: { x: number; y: number }) => {
          if (!dragging.current) return;
          const j = live.current.hit(e.x, e.y);
          if (j !== null) live.current.dispatch({ type: 'dragMove', i: j });
        },
        onDeactivate: () => {
          if (!dragging.current) return;
          dragging.current = false;
          live.current.dispatch({ type: 'dragEnd' });
        },
        onFinalize: () => {
          begin.current = null;
          clearPress();
        },
        ...(web
          ? {
              // Mouse: activate on the first move beyond 6 px. Touch: activate after 280 ms held still; moving
              // earlier fails the gesture and the browser scrolls (touch-action: pan-y).
              onTouchesDown: (e: { handlerTag: number; pointerType: PointerType; changedTouches: Point[] }) => {
                const t = e.changedTouches[0];
                if (!t || press.current) return;
                const mouse = e.pointerType === PointerType.MOUSE;
                press.current = { x: t.x, y: t.y, mouse };
                if (!mouse) press.current.timer = setTimeout(() => GestureStateManager.activate(e.handlerTag), LONG_PRESS_MS);
              },
              onTouchesMove: (e: { handlerTag: number; allTouches: Point[] }) => {
                const p = press.current;
                const t = e.allTouches[0];
                if (!p || !t || Math.hypot(t.x - p.x, t.y - p.y) <= MOUSE_SLOP) return;
                clearPress();
                if (p.mouse) GestureStateManager.activate(e.handlerTag);
                else GestureStateManager.fail(e.handlerTag);
              },
              onTouchesUp: clearPress,
              onTouchesCancel: clearPress,
              // Also in the config: a config update resets the web handler's touchAction (see CardStepper).
              touchAction: 'pan-y',
              userSelect: 'none',
            }
          : {}),
      }) as PanGestureConfig,
    // Callbacks read `live`; only these change the config (a new config object reconfigures the native handler).
    [readOnly, web],
  );
  const pan = usePanGesture(panConfig);

  const tapConfig = useMemo(
    () =>
      ({
        runOnJS: true,
        enabled: !readOnly,
        maxDistance: 10,
        onActivate: (e: { x: number; y: number }) => {
          const i = live.current.hit(e.x, e.y);
          if (i !== null) live.current.dispatch({ type: 'tap', sourceId: live.current.sourceId, i });
        },
        ...(web ? { touchAction: 'pan-y', userSelect: 'none' } : {}),
      }) as TapGestureConfig,
    [readOnly, web],
  );
  const tap = useTapGesture(tapConfig);
  // The pan wins; a tap is recognised once the pan has failed (released before the long-press / mouse slop).
  const gesture = useExclusiveGestures(pan, tap);

  // Touch web: once a drag is active, stop the browser from scrolling (touch-action pan-y would otherwise let it).
  const rootRef = useRef<ComponentRef<typeof View>>(null);
  useEffect(() => {
    if (!web) return;
    type Listener = (e: { preventDefault(): void }) => void;
    const el = rootRef.current as unknown as {
      addEventListener?: (t: string, l: Listener, o: { passive: boolean }) => void;
      removeEventListener?: (t: string, l: Listener) => void;
    } | null;
    if (!el?.addEventListener) return;
    const stop: Listener = (e) => {
      if (dragging.current) e.preventDefault();
    };
    el.addEventListener('touchmove', stop, { passive: false });
    return () => el.removeEventListener?.('touchmove', stop);
  }, [web]);

  // ---- Handles ----
  const [lifted, setLifted] = useState<'start' | 'end' | null>(null);
  const liftOrigin = useRef<Point | null>(null);
  const centre = (i: number): Point | null => {
    const b = boxOf(i);
    return b ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : null;
  };
  const handleLive = useRef({ centre });
  handleLive.current = { centre };
  const activeMark = state.active === null ? undefined : state.marks[state.active];
  const handleCallbacks = useMemo(
    () => ({
      lift: (end: 'start' | 'end', i: number) => {
        liftOrigin.current = handleLive.current.centre(i);
        setLifted(end);
        live.current.dispatch({ type: 'handleStart', end });
      },
      move: (dx: number, dy: number) => {
        const o = liftOrigin.current;
        const j = o && live.current.hit(o.x + dx, o.y + dy);
        if (j !== null && j !== undefined) live.current.dispatch({ type: 'dragMove', i: j });
      },
      drop: () => {
        if (!liftOrigin.current) return;
        liftOrigin.current = null;
        setLifted(null);
        live.current.dispatch({ type: 'dragEnd' });
      },
    }),
    [],
  );
  // Handle centre in text coordinates: top-left of the first word, bottom-right of the last one (as the mockup).
  const handlePoint = (end: 'start' | 'end', i: number): Point | null => {
    const b = boxOf(i);
    const inner = layout.current.inner.get(i);
    if (!b || !inner) return null;
    return end === 'start' ? { x: b.x + inner.x, y: b.y + 2 } : { x: b.x + inner.x + inner.width, y: b.y + b.height - 2 };
  };
  const handles: { end: 'start' | 'end'; i: number; side: 'start' | 'end' }[] = [];
  const drag = state.drag?.sourceId === source.id ? state.drag : null;
  if (!readOnly && drag && lifted) {
    // Keep the dragged handle mounted (its gesture is still running) at the moving end.
    handles.push({ end: lifted, i: drag.b, side: drag.b < drag.a ? 'start' : 'end' });
  } else if (!readOnly && !drag && activeMark?.sourceId === source.id) {
    handles.push({ end: 'start', i: activeMark.from, side: 'start' }, { end: 'end', i: activeMark.to, side: 'end' });
  }

  // ---- Paint ----
  const metrics = reading ? READING_TEXT : BODY_TEXT;
  const textStyle = useMemo<TextStyle>(
    () => ({ fontFamily: reading ? fontFamily.reading : fontFamily.body, fontSize: metrics.size, lineHeight: metrics.lineHeight }),
    [reading, metrics],
  );
  const lineGap = metrics.lineGap;
  const onWordLayout = useCallback((i: number, e: LayoutChangeEvent) => void layout.current.words.set(i, e.nativeEvent.layout), []);
  const onInnerLayout = useCallback((i: number, e: LayoutChangeEvent) => void layout.current.inner.set(i, e.nativeEvent.layout), []);
  const onA11yTap = useCallback((i: number) => live.current.dispatch({ type: 'tap', sourceId: live.current.sourceId, i }), []);

  const paintOf = (i: number) => {
    const w = words[i]!;
    const sameParagraphNext = words[i + 1]?.paragraph === w.paragraph;
    let pen: Pen | null = null;
    let from = -1;
    let to = -1;
    if (drag && i >= Math.min(drag.a, drag.b) && i <= Math.max(drag.a, drag.b)) {
      pen = drag.pen;
      from = Math.min(drag.a, drag.b);
      to = Math.max(drag.a, drag.b);
    } else {
      const m = state.marks.find((x) => x.sourceId === source.id && i >= x.from && i <= x.to);
      if (m) ({ pen, from, to } = m);
    }
    const v = verdicts?.find((x) => x.sourceId === source.id && i >= x.from && i <= x.to);
    return {
      pen,
      first: i === from,
      last: i === to,
      cont: pen !== null && i < to && sameParagraphNext,
      verdict: v?.verdict ?? null,
      verdictCont: !!v && i < v.to && sameParagraphNext,
      anchor: !readOnly && state.anchor?.sourceId === source.id && state.anchor.i === i,
    };
  };

  return (
    <GestureDetector gesture={gesture} touchAction="pan-y" userSelect="none">
      <View ref={rootRef} onLayout={onRootLayout} style={styles.root}>
        {paragraphs.map((ws, p) => (
          <View
            key={p}
            testID={`paragraph-${p}`}
            style={[styles.paragraph, p > 0 && styles.paragraphGap]}
            onLayout={(e) => void layout.current.paragraphs.set(p, e.nativeEvent.layout)}
          >
            {ws.map((w) => (
              <Word
                key={w.i}
                i={w.i}
                text={w.text}
                omission={w.omission}
                {...paintOf(w.i)}
                textStyle={textStyle}
                lineGap={lineGap}
                interactive={!readOnly}
                onLayout={onWordLayout}
                onInnerLayout={onInnerLayout}
                onA11yTap={onA11yTap}
              />
            ))}
          </View>
        ))}
        {handles.map((h) => {
          const at = handlePoint(h.side, h.i);
          return at ? <Handle key={h.end} end={h.end} wordIndex={h.i} at={at} callbacks={handleCallbacks} /> : null;
        })}
      </View>
    </GestureDetector>
  );
}

type WordProps = {
  i: number;
  text: string;
  omission: boolean;
  pen: Pen | null;
  first: boolean;
  last: boolean;
  cont: boolean;
  verdict: Verdict | null;
  verdictCont: boolean;
  anchor: boolean;
  textStyle: TextStyle;
  lineGap: number;
  interactive: boolean;
  onLayout: (i: number, e: LayoutChangeEvent) => void;
  onInnerLayout: (i: number, e: LayoutChangeEvent) => void;
  onA11yTap: (i: number) => void;
};

/** One word plus its trailing space; the space takes the mark colour when the next word is in the same mark. */
const Word = memo(function Word(p: WordProps) {
  const bg = p.pen ? { backgroundColor: markerPen[p.pen] } : null;
  const native = Platform.OS !== 'web'; // web screen readers read the DOM text; 500 tab stops would not help
  return (
    <View
      testID={`word-box-${p.i}`}
      style={[styles.word, { marginVertical: p.lineGap }]}
      onLayout={(e) => p.onLayout(p.i, e)}
      accessible={native}
      accessibilityLabel={p.pen ? `${p.text}, marcat ${PEN_LABEL[p.pen]}` : p.text}
      accessibilityHint={p.interactive ? HINT : undefined}
      accessibilityActions={p.interactive ? [{ name: 'activate' }] : undefined}
      onAccessibilityAction={p.interactive ? (e) => e.nativeEvent.actionName === 'activate' && p.onA11yTap(p.i) : undefined}
    >
      <View
        testID={`word-${p.i}`}
        onLayout={(e) => p.onInnerLayout(p.i, e)}
        style={[bg, p.pen && p.first && styles.markStart, p.pen && p.last && styles.markEnd]}
      >
        <Text style={[p.textStyle, { color: p.omission ? color.textMuted : color.text }]}>{p.text}</Text>
        {p.verdict ? <View testID={`verdict-${p.i}`} style={[styles.underline, { backgroundColor: VERDICT_COLOR[p.verdict] }]} /> : null}
        {p.anchor ? <AnchorOutline i={p.i} /> : null}
      </View>
      <View testID={`space-${p.i}`} style={p.cont ? bg : undefined}>
        <Text style={p.textStyle}> </Text>
        {p.verdict && p.verdictCont ? <View style={[styles.underline, { backgroundColor: VERDICT_COLOR[p.verdict] }]} /> : null}
      </View>
    </View>
  );
});

/** Blinking dashed outline on the first word of a tap-tap selection. */
function AnchorOutline({ i }: { i: number }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.15, { duration: BLINK_MS / 2, easing: Easing.inOut(Easing.ease), reduceMotion: ReduceMotion.System }),
      -1,
      true,
    );
  }, [opacity]);
  const blink = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View testID={`anchor-${i}`} pointerEvents="none" style={[styles.anchor, blink]} />;
}

type HandleCallbacks = { lift: (end: 'start' | 'end', i: number) => void; move: (dx: number, dy: number) => void; drop: () => void };

/**
 * A round handle at one end of the active mark. Its own pan starts on the first move (no long-press) and drags
 * that end; the moving point is the word's centre plus the finger's absolute travel, so it does not depend on
 * the handle view following the finger.
 */
function Handle({ end, wordIndex, at, callbacks }: { end: 'start' | 'end'; wordIndex: number; at: Point; callbacks: HandleCallbacks }) {
  const word = useRef(wordIndex);
  word.current = wordIndex;
  const origin = useRef<Point | null>(null);
  const config = useMemo(
    () =>
      ({
        runOnJS: true,
        minDistance: 1,
        onBegin: (e: { absoluteX: number; absoluteY: number }) => {
          origin.current = { x: e.absoluteX, y: e.absoluteY };
        },
        onActivate: () => callbacks.lift(end, word.current),
        onUpdate: (e: { absoluteX: number; absoluteY: number }) => {
          const o = origin.current;
          if (o) callbacks.move(e.absoluteX - o.x, e.absoluteY - o.y);
        },
        onFinalize: () => {
          origin.current = null;
          callbacks.drop();
        },
        ...(Platform.OS === 'web' ? { touchAction: 'none', userSelect: 'none' } : {}),
      }) as PanGestureConfig,
    [end, callbacks],
  );
  const pan = usePanGesture(config);
  const size = HANDLE + 2 * HANDLE_SLOP;
  return (
    <GestureDetector gesture={pan} touchAction="none" userSelect="none">
      <View
        testID={`handle-${end}`}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.handleArea, { width: size, height: size, left: at.x - size / 2, top: at.y - size / 2 }]}
      >
        <View style={styles.handleDot} />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { position: 'relative' },
  paragraph: { flexDirection: 'row', flexWrap: 'wrap' },
  paragraphGap: { marginTop: PARAGRAPH_GAP },
  word: { flexDirection: 'row' },
  markStart: { borderTopLeftRadius: END_RADIUS, borderBottomLeftRadius: END_RADIUS, paddingLeft: 2, marginLeft: -2 },
  markEnd: { borderTopRightRadius: END_RADIUS, borderBottomRightRadius: END_RADIUS, paddingRight: 2, marginRight: -2 },
  underline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: UNDERLINE },
  anchor: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: color.primary,
    borderRadius: 3,
  },
  handleArea: { position: 'absolute', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  handleDot: {
    width: HANDLE,
    height: HANDLE,
    borderRadius: HANDLE / 2,
    backgroundColor: color.text,
    borderWidth: 2,
    borderColor: color.surface,
  },
});
