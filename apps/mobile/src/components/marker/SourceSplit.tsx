import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { border, color, radius, space, type Mark, type SourceLabel } from '@prepio/shared';
import type { DragGesture } from './MarkableText';
import { ReadingText, SourceTabs, useScrollToMark, type PanelMarker, type PanelSource } from './SourceReader';

// ~62 characters of 17 px Literata (mockup `max-width: 62ch`).
const READING_WIDTH = 640;
// The source column scrolls on its own; it takes the window height minus the app's top and action bars.
const CHROME = 180;
const MIN_HEIGHT = 420;

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
 */
export default function SourceSplit({ sources, label, onLabel, marker, scrollTo, children }: Props) {
  const { height } = useWindowDimensions();
  const current = sources.find((s) => s.label === label) ?? sources[0];
  const [drag, setDrag] = useState<DragGesture | undefined>(undefined);
  const onDragGesture = useCallback((g: DragGesture) => setDrag((prev) => (prev && prev.handlerTag === g.handlerTag ? prev : g)), []);
  const { scrollRef, wordBoxRef, onTextLayout, onViewportLayout } = useScrollToMark(scrollTo, [label]);
  if (!current) return null;
  return (
    <View testID="source-split" style={styles.split}>
      <View style={[styles.left, { height: Math.max(MIN_HEIGHT, height - CHROME) }]} onLayout={onViewportLayout}>
        <ScrollView ref={scrollRef as never} testID="split-scroll" contentContainerStyle={styles.leftBody} requireToFail={drag}>
          <View style={styles.reading}>
            <SourceTabs sources={sources} label={current.label} onLabel={onLabel} testPrefix="split" />
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
    backgroundColor: color.surface,
    borderWidth: border.hairline,
    borderColor: color.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  leftBody: { paddingVertical: space[5.5], paddingHorizontal: space[8] },
  reading: { width: '100%', maxWidth: READING_WIDTH },
  right: { flex: 1, minWidth: 0, gap: space[3] },
});
