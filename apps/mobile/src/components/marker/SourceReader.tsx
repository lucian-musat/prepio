import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  border,
  color,
  consolidationColor,
  feedbackText,
  markerPen,
  radius,
  space,
  tokenizeSource,
  type ExerciseFeedback,
  type Mark,
  type Source,
  type SourceLabel,
} from '@prepio/shared';
import { fontFamily } from '../../theme/fonts';
import { AppText, Button, IconButton } from '../../ui';
import { raisedShadow } from '../../ui/elevation';
import MarkableText, { PEN_LABEL, type DragGesture } from './MarkableText';
import type { MarkerAction, MarkerConfig, MarkerState, Pen } from './markerReducer';

export type PanelSource = { source: Source; label: SourceLabel };
/** `readOnly` (after checking): the marks and verdicts stay visible, but nothing can be marked and no pens show. */
export type PanelMarker = {
  cfg: MarkerConfig;
  state: MarkerState;
  dispatch: (a: MarkerAction) => void;
  verdicts?: ExerciseFeedback['marks'];
  readOnly?: boolean;
};
/** The marker can mark (present and not read-only). */
export const canMark = (m?: PanelMarker): m is PanelMarker => !!m && !m.readOnly;

export const HINT = {
  start: 'Trage peste text (ține apăsat, apoi trage) sau atinge primul și ultimul cuvânt.',
  anchored: 'Atinge ultimul cuvânt al informației.',
  causeDone: 'Cauza e marcată. Acum marchează efectul.',
  effectDone: 'Acum marchează cauza.',
  bothDone: 'Ambele marcate. Apasă „Gata” sau ajustează capetele.',
} as const;

/** The one-line next step under the pens (long-sources mockup `#msg`). */
export function hintFor(cfg: MarkerConfig, s: MarkerState): string {
  if (s.anchor) return HINT.anchored;
  if (cfg.pens.includes('cause') && cfg.pens.includes('effect')) {
    const c = s.marks.some((m) => m.pen === 'cause');
    const e = s.marks.some((m) => m.pen === 'effect');
    if (c && e) return HINT.bothDone;
    if (c) return HINT.causeDone;
    if (e) return HINT.effectDone;
  }
  return HINT.start;
}

export const citation = (s: Source) => [s.author, s.work].filter(Boolean).join(', ');

// Without a marker the text is read-only; MarkableText still needs a state and a dispatch.
export const NO_MARKS: MarkerState = { pen: 'info', marks: [], anchor: null, drag: null, active: null };
export const noop = () => {};

/** The pen buttons (✓ once the pen has a mark); only the exercise's pens. */
export function PenBar({ marker }: { marker: PanelMarker }) {
  const { cfg, state, dispatch } = marker;
  return (
    <View style={styles.pens}>
      {cfg.pens.map((pen) => {
        const on = state.pen === pen;
        const used = state.marks.some((m) => m.pen === pen);
        return (
          <Pressable
            key={pen}
            testID={`pen-${pen}`}
            accessibilityRole="button"
            accessibilityLabel={`Marker ${PEN_LABEL[pen]}${used ? ', folosit' : ''}`}
            accessibilityState={{ selected: on }}
            onPress={() => dispatch({ type: 'setPen', pen })}
            style={[styles.pen, on && styles.penOn]}
          >
            <View style={[styles.swatch, { backgroundColor: markerPen[pen] }]} />
            <AppText role="label" numberOfLines={1} style={styles.penLabel}>
              {PEN_LABEL[pen]}
            </AppText>
            <AppText role="caption" style={styles.check}>
              {used ? '✓' : ''}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** „Sursa A / Sursa B” tabs (shown only with two sources). */
export function SourceTabs({ sources, label, onLabel, testPrefix }: { sources: PanelSource[]; label: SourceLabel; onLabel: (l: SourceLabel) => void; testPrefix: string }) {
  if (sources.length < 2) return null;
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {sources.map((s) => {
        const on = s.label === label;
        return (
          <Pressable
            key={s.label}
            testID={`${testPrefix}-tab-${s.label}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onLabel(s.label)}
            style={[styles.tab, on && styles.tabOn]}
          >
            <AppText role="label" color={on ? 'primary' : 'text'}>
              Sursa {s.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

type TextProps = {
  source: Source;
  marker?: PanelMarker;
  /** Filled by the text with a word-position lookup (see useScrollToMark). */
  wordBoxRef: { current: ((i: number) => { y: number; height: number } | null) | null };
  onDragGesture: (g: DragGesture) => void;
  onTextLayout?: (e: LayoutChangeEvent) => void;
};

/** The source in reading type, then its citation (mockup `.r-text` + `.r-cite`). */
export function ReadingText({ source, marker, wordBoxRef, onDragGesture, onTextLayout }: TextProps) {
  return (
    <>
      <View onLayout={onTextLayout}>
        <MarkableText
          source={source}
          state={marker?.state ?? NO_MARKS}
          dispatch={marker?.dispatch ?? noop}
          verdicts={marker?.verdicts}
          readOnly={!canMark(marker)}
          reading
          onDragGesture={onDragGesture}
          wordBoxRef={wordBoxRef}
        />
      </View>
      <AppText role="caption" color="textMuted" style={styles.cite}>
        ({citation(source)})
      </AppText>
    </>
  );
}

/**
 * Scrolls `scroll` so the mark's first word sits a third of the way down. The words are measured after the
 * first frames, so it retries for a short while; it gives up quietly (the text then simply starts at the top).
 * `offset`: how far the text's parent sits below the scroll content's top (e.g. the content padding), since the
 * text's layout y is relative to its parent.
 */
export function useScrollToMark(target: Mark | null, deps: unknown[], offset = 0) {
  const scrollRef = useRef<{ scrollTo: (o: { y: number; animated: boolean }) => void } | null>(null);
  const wordBoxRef = useRef<((i: number) => { y: number; height: number } | null) | null>(null);
  const textTop = useRef(0);
  const viewport = useRef(0);
  useEffect(() => {
    if (!target) return;
    let frames = 0;
    let raf = 0;
    const tryScroll = () => {
      const box = wordBoxRef.current?.(target.from);
      if (box && scrollRef.current) {
        scrollRef.current.scrollTo({ y: Math.max(0, offset + textTop.current + box.y - viewport.current / 3), animated: false });
        return;
      }
      if (++frames < 30) raf = requestAnimationFrame(tryScroll);
    };
    raf = requestAnimationFrame(tryScroll);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, ...deps]);
  return {
    scrollRef,
    wordBoxRef,
    onTextLayout: (e: LayoutChangeEvent) => void (textTop.current = e.nativeEvent.layout.y),
    onViewportLayout: (e: LayoutChangeEvent) => void (viewport.current = e.nativeEvent.layout.height),
  };
}

type ReaderProps = {
  visible: boolean;
  sources: PanelSource[];
  label: SourceLabel;
  onLabel: (l: SourceLabel) => void;
  prompt: string;
  marker?: PanelMarker;
  /** The mark to scroll to when the reader opens (from an answer slot). */
  scrollTo: Mark | null;
  onClose: () => void;
};

/**
 * Full-screen reader for a long source (long-sources mockup `.reader`): slides up over the exercise. Top bar
 * (✕, „Sursa B”, citation), the requirement on one line (tap to expand), A / B tabs, the text in reading type
 * with a minimap of the marks, and a tray with the pens, the next-step hint and „Gata”.
 */
export default function SourceReader({ visible, sources, label, onLabel, prompt, marker, scrollTo, onClose }: ReaderProps) {
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(false);
  const [tray, setTray] = useState(0);
  const [drag, setDrag] = useState<DragGesture | undefined>(undefined);
  // Keep the first gesture object of a text (a stable gesture keeps its handler tag; avoids render loops).
  const onDragGesture = useCallback((g: DragGesture) => setDrag((prev) => (prev && prev.handlerTag === g.handlerTag ? prev : g)), []);
  const current = sources.find((s) => s.label === label) ?? sources[0];
  const { scrollRef, wordBoxRef, onTextLayout, onViewportLayout } = useScrollToMark(visible ? scrollTo : null, [visible, label]);
  useEffect(() => {
    if (!visible) setExpanded(false);
  }, [visible]);
  if (!current) return null;

  const count = Math.max(1, tokenizeSource(current.source.body).words.length);
  const marks = marker?.state.marks.filter((m) => m.sourceId === current.source.id) ?? [];
  // The tray floats above the gesture bar / home indicator; the text and the minimap end above the tray.
  const trayBottom = insets.bottom + space[2.5];
  const aboveTray = trayBottom + tray;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {/* Modals are a separate native root: gestures inside need their own root view on Android. */}
      <GestureHandlerRootView style={styles.fill}>
        <View testID="source-reader" style={[styles.reader, { paddingTop: insets.top }]}>
          <View style={styles.top}>
            <IconButton icon="close" accessibilityLabel="Închide sursa" onPress={onClose} />
            <View style={styles.fill}>
              <AppText role="bar" accessibilityRole="header">
                Sursa {current.label}
              </AppText>
              <AppText role="caption" color="textMuted" numberOfLines={1}>
                {citation(current.source)}
              </AppText>
            </View>
          </View>
          <Pressable
            testID="reader-task"
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityHint={expanded ? 'Restrânge cerința' : 'Arată toată cerința'}
            onPress={() => setExpanded((x) => !x)}
            style={styles.task}
          >
            <AppText testID="reader-task-text" role="note" numberOfLines={expanded ? undefined : 1} style={styles.fill}>
              <AppText role="note" style={styles.bold}>
                Cerința:
              </AppText>{' '}
              {prompt}
            </AppText>
            <AppText role="label" color="primary">
              {expanded ? '▴' : '▾'}
            </AppText>
          </Pressable>
          <View style={styles.fill} onLayout={onViewportLayout}>
            <ScrollView
              ref={scrollRef as never}
              testID="reader-scroll"
              style={styles.fill}
              contentContainerStyle={[styles.body, { paddingBottom: aboveTray + space[6] }]}
              requireToFail={drag}
            >
              <SourceTabs sources={sources} label={current.label} onLabel={onLabel} testPrefix="reader" />
              <ReadingText
                key={current.source.id}
                source={current.source}
                marker={marker}
                wordBoxRef={wordBoxRef}
                onDragGesture={onDragGesture}
                onTextLayout={onTextLayout}
              />
            </ScrollView>
            <View pointerEvents="none" style={[styles.mini, { bottom: aboveTray + space[2] }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {marks.map((m, k) => (
                <View
                  key={k}
                  testID={`minimap-${k}`}
                  style={[
                    styles.miniBar,
                    { top: `${(m.from / count) * 100}%`, height: `${Math.max(2, ((m.to - m.from + 1) / count) * 100)}%`, backgroundColor: markerPen[m.pen] },
                  ]}
                />
              ))}
            </View>
          </View>
          <View style={[styles.tray, { bottom: trayBottom }]} onLayout={(e) => setTray(e.nativeEvent.layout.height)}>
            {canMark(marker) ? (
              <>
                <PenBar marker={marker} />
                <AppText role="caption" color="textMuted" style={styles.hint} accessibilityLiveRegion="polite">
                  {hintFor(marker.cfg, marker.state)}
                </AppText>
              </>
            ) : null}
            <Button label="Gata" onPress={onClose} />
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  reader: { flex: 1, backgroundColor: consolidationColor.paper },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2.5],
    paddingHorizontal: space[3.5],
    paddingTop: space[3],
    paddingBottom: space[2.5],
    borderBottomWidth: border.hairline,
    borderBottomColor: color.border,
  },
  task: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[2],
    marginHorizontal: space[3.5],
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    backgroundColor: color.primarySubtle,
    borderBottomLeftRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
  },
  bold: { fontFamily: fontFamily.bodyBold },
  body: { paddingTop: space[4], paddingHorizontal: space[5.5] },
  cite: { fontStyle: 'italic', textAlign: 'right', marginTop: space[3.5] },
  mini: { position: 'absolute', right: space[1], top: space[2], width: 4, borderRadius: 2, backgroundColor: color.surfaceMuted },
  miniBar: { position: 'absolute', left: -1, width: 6, borderRadius: 3 },
  tray: {
    position: 'absolute',
    left: space[2.5],
    right: space[2.5],
    padding: space[2.5],
    gap: space[2],
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: border.hairline,
    borderColor: color.border,
    boxShadow: raisedShadow('up'),
  },
  hint: { marginHorizontal: 2, minHeight: 17 },
  pens: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  pen: {
    flexGrow: 1,
    flexBasis: 120,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    borderWidth: border.thick,
    borderColor: color.border,
    backgroundColor: color.surface,
    borderRadius: radius.sm,
    paddingVertical: space[2],
    paddingHorizontal: space[2.5],
  },
  penOn: { borderColor: color.text, boxShadow: `0px 2px 0px ${color.text}` },
  swatch: { width: 20, height: 12, borderRadius: 4, transform: [{ skewX: '-12deg' }] },
  penLabel: { flexShrink: 1 },
  check: { marginLeft: 'auto', color: feedbackText.good },
  tabs: { flexDirection: 'row', gap: space[1.5], marginBottom: space[3.5] },
  tab: {
    borderWidth: 1.5,
    borderColor: color.border,
    borderRadius: radius.pill,
    paddingVertical: space[1],
    paddingHorizontal: space[3],
    backgroundColor: color.surface,
  },
  tabOn: { borderColor: color.primary, backgroundColor: color.primarySubtle },
});
