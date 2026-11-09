import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { isShortSource, space, type Mark, type SourceLabel } from '@prepio/shared';
import { AppText, Surface } from '../../ui';
import MarkableText from './MarkableText';
import type { Pen } from './markerReducer';
import SourceCard from './SourceCard';
import SourceReader, { canMark, citation, hintFor, NO_MARKS, noop, PenBar, type PanelMarker, type PanelSource } from './SourceReader';
import SourceSplit from './SourceSplit';

/** From this window width the source sits beside the answer instead of behind a card and a reader. */
export const SPLIT_MIN_WIDTH = 900;

type PanelApi = { open: (pen: Pen, markIndex: number | null) => void };
const PanelContext = createContext<PanelApi | null>(null);
/** Inside a SourcePanel: opens the source with a pen (answer slots use it). */
export const useSourcePanel = () => useContext(PanelContext);

type Props = {
  sources: PanelSource[];
  prompt: string;
  /** Before the prompt, in the prompt's line (a BAC item's „5.”). */
  promptLead?: string;
  /** After the prompt, smaller and muted (a BAC item's „· 7 puncte”). */
  promptTail?: string;
  marker?: PanelMarker;
  /** Above the prompt (the type chip, „💡 Cum rezolv”); on desktop it sits in the right column with the prompt. */
  header?: ReactNode;
  /** The answer area (slots / fields). */
  children: ReactNode;
};

/**
 * The exercise's prompt and sources, laid out for the screen (long-sources mockup):
 * - a short source (< ~70 words) inline, in a card, marked in place;
 * - a long source on the phone as a preview card that opens the full-screen reader;
 * - from 900 px wide, the long source in a left column beside the prompt and the answer.
 * Answer slots inside `children` open the source with their pen through `useSourcePanel`.
 */
export default function SourcePanel({ sources, prompt, promptLead, promptTail, marker, header, children }: Props) {
  const { width } = useWindowDimensions();
  const isLong = useMemo(() => new Map(sources.map((s) => [s.label, !isShortSource(s.source.body)])), [sources]);
  const longSources = sources.filter((s) => isLong.get(s.label));
  const split = width >= SPLIT_MIN_WIDTH && longSources.length > 0;

  const [readerOpen, setReaderOpen] = useState(false);
  // The source shown in the reader / the split's left column, and a mark to bring into view there.
  const [label, setLabel] = useState<SourceLabel>((longSources[0] ?? sources[0])?.label ?? 'A');
  const [scrollTo, setScrollTo] = useState<Mark | null>(null);

  const showSource = (l: SourceLabel, mark: Mark | null) => {
    setLabel(l);
    setScrollTo(mark ? { ...mark } : null); // a fresh object scrolls again, even to the same mark
  };
  const openReader = (l: SourceLabel, mark: Mark | null = null) => {
    showSource(l, mark);
    setReaderOpen(true);
  };
  const closeReader = () => {
    marker?.dispatch({ type: 'cancel' });
    setReaderOpen(false);
  };

  const api: PanelApi = {
    open: (pen, markIndex) => {
      if (!marker) return;
      if (!marker.readOnly) marker.dispatch({ type: 'setPen', pen });
      const marks = marker.state.marks;
      const mark = (markIndex !== null ? marks[markIndex] : undefined) ?? marks.find((m) => m.pen === pen) ?? null;
      const target = (mark && sources.find((s) => s.source.id === mark.sourceId)) || longSources.find((s) => s.label === label) || longSources[0];
      // A mark in a short source is already on screen: choosing the pen is enough.
      if (!target || !isLong.get(target.label)) return;
      if (split) showSource(target.label, mark);
      else openReader(target.label, mark);
    },
  };

  const pens = canMark(marker) ? (
    <View style={styles.pens}>
      <PenBar marker={marker} />
      <AppText role="caption" color="textMuted" accessibilityLiveRegion="polite">
        {hintFor(marker.cfg, marker.state)}
      </AppText>
    </View>
  ) : null;
  const promptText =
    promptLead || promptTail ? (
      <AppText role="question">
        {promptLead ? (
          <AppText role="question" color="primary">
            {promptLead}{' '}
          </AppText>
        ) : null}
        <AppText role="question">{prompt}</AppText>
        {promptTail ? (
          <>
            {' '}
            <AppText role="note" color="textMuted">
              {promptTail}
            </AppText>
          </>
        ) : null}
      </AppText>
    ) : (
      <AppText role="question">{prompt}</AppText>
    );

  if (split) {
    return (
      <PanelContext.Provider value={api}>
        <SourceSplit sources={longSources} label={label} onLabel={(l) => showSource(l, null)} marker={marker} scrollTo={scrollTo}>
          {header}
          {promptText}
          {sources.filter((s) => !isLong.get(s.label)).map((s) => (
            <InlineSource key={s.label} item={s} marker={marker} />
          ))}
          {pens}
          {children}
        </SourceSplit>
      </PanelContext.Provider>
    );
  }

  const anyInline = sources.some((s) => !isLong.get(s.label));
  return (
    <PanelContext.Provider value={api}>
      <View style={styles.column}>
        {header}
        {promptText}
        {sources.map((s) =>
          isLong.get(s.label) ? (
            <SourceCard key={s.label} source={s.source} label={s.label} marking={canMark(marker)} onPress={() => openReader(s.label)} />
          ) : (
            <InlineSource key={s.label} item={s} marker={marker} />
          ),
        )}
        {/* Pens for marking in place; with long sources only, they live in the reader's tray. */}
        {anyInline ? pens : null}
        {children}
      </View>
      {longSources.length > 0 ? (
        <SourceReader
          visible={readerOpen}
          sources={longSources}
          label={label}
          onLabel={(l) => showSource(l, null)}
          prompt={prompt}
          marker={marker}
          scrollTo={scrollTo}
          onClose={closeReader}
        />
      ) : null}
    </PanelContext.Provider>
  );
}

/** A short source shown in the exercise (types mockup `.src`): „SURSA A”, the text, marked in place, the citation. */
function InlineSource({ item, marker }: { item: PanelSource; marker?: PanelMarker }) {
  return (
    <Surface testID={`source-inline-${item.label}`} padding={3.5} radius="lg" style={styles.inline}>
      <AppText role="eyebrow" color="textMuted">
        Sursa {item.label}
      </AppText>
      <MarkableText
        source={item.source}
        state={marker?.state ?? NO_MARKS}
        dispatch={marker?.dispatch ?? noop}
        verdicts={marker?.verdicts}
        readOnly={!canMark(marker)}
      />
      <AppText role="caption" color="textMuted" style={styles.cite}>
        ({citation(item.source)})
      </AppText>
    </Surface>
  );
}

const styles = StyleSheet.create({
  column: { gap: space[3] },
  pens: { gap: space[2] },
  inline: { gap: space[1.5] },
  cite: { fontStyle: 'italic' },
});
