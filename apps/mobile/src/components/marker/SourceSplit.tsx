import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { border, color, consolidationColor, radius, space, type Mark, type SourceLabel } from '@prepio/shared';
import { t } from '../../texts/store';
import { AppText, useScreenViewport } from '../../ui';
import type { DragGesture } from './MarkableText';
import { ReadingText, SourceTabs, useScrollToMark, type PanelMarker, type PanelSource } from './SourceReader';

// ~62 characters of 17 px Literata (mockup `max-width: 62ch`).
const READING_WIDTH = 640;
// Outside a ScreenLayout (no measured viewport): the window height minus about the app's top and action bars.
const CHROME_GUESS = 180;
const MIN_HEIGHT = 420;
// Mockup `.split .left` padding: 22 px / 34 px (here 22 / 32).
const PAD_V = space[5.5];

type Props = {
  sources: PanelSource[];
  label: SourceLabel;
  onLabel: (l: SourceLabel) => void;
  marker?: PanelMarker;
  /** A mark to bring into view (from an answer slot); a new object scrolls again. */
  scrollTo: Mark | null;
  /** The right column: the prompt, the pens and the answer. */
  children: ReactNode;
};

/**
 * Desktop (≥ 900 px) layout, as on the exam sheet (long-sources mockup `.split`): the source on the left in its
 * own scroll, at reading width, with A / B tabs; the requirement, the pens and the answer on the right.
 * Inside a ScreenLayout the left column is exactly as tall as the screen's scroll viewport.
 */
export default function SourceSplit({ sources, label, onLabel, marker, scrollTo, children }: Props) {
  const { height } = useWindowDimensions();
  const viewport = useScreenViewport();
  const current = sources.find((s) => s.label === label) ?? sources[0];
  const [drag, setDrag] = useState<DragGesture | undefined>(undefined);
  const onDragGesture = useCallback((g: DragGesture) => setDrag((prev) => (prev && prev.handlerTag === g.handlerTag ? prev : g)), []);
  // The text's layout y is relative to the reading column, which sits below the scroll content's top padding.
  const { scrollRef, wordBoxRef, onTextLayout, onViewportLayout } = useScrollToMark(scrollTo, [label], PAD_V);
  if (!current) return null;
  const columnHeight = Math.max(MIN_HEIGHT, viewport ?? height - CHROME_GUESS);
  return (
    <View testID="source-split" style={styles.split}>
      <View testID="split-left" style={[styles.left, { height: columnHeight }]} onLayout={onViewportLayout}>
        <ScrollView ref={scrollRef as never} testID="split-scroll" contentContainerStyle={styles.leftBody} requireToFail={drag}>
          <View style={styles.reading}>
            {sources.length > 1 ? (
              <SourceTabs sources={sources} label={current.label} onLabel={onLabel} testPrefix="split" />
            ) : (
              // One long source: name it, since the requirement refers to it by its letter.
              <AppText role="eyebrow" color="textMuted" style={styles.label}>
                {t('consolidation.source.title', { litera: current.label })}
              </AppText>
            )}
            <ReadingText
              key={current.source.id}
              source={current.source}
              marker={marker}
              wordBoxRef={wordBoxRef}
              onDragGesture={onDragGesture}
              onTextLayout={onTextLayout}
            />
          </View>
        </ScrollView>
      </View>
      <View style={styles.right}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  split: { flexDirection: 'row', alignItems: 'flex-start', gap: space[6] },
  left: {
    flex: 1.15,
    minWidth: 0,
    backgroundColor: consolidationColor.paper,
    borderWidth: border.hairline,
    borderColor: color.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  leftBody: { paddingVertical: PAD_V, paddingHorizontal: space[8] },
  reading: { width: '100%', maxWidth: READING_WIDTH },
  label: { marginBottom: space[2] },
  right: { flex: 1, minWidth: 0, gap: space[3] },
});
