import { useEffect, useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  space,
  tokenizeSource,
  type ConsolidationExercise,
  type ConsolidationType,
  type ExerciseAnswer,
  type ExerciseFeedback,
  type Mark,
  type Source,
  type Verdict,
} from '@prepio/shared';
import { AppText } from '../../ui';
import type { MarkerMark } from '../marker/markerReducer';
import type { PanelMarker } from '../marker/SourceReader';

/** What every exercise input gets: the answer is controlled by the exercise screen. */
export type InputProps<T extends ConsolidationType> = {
  exercise: Extract<ConsolidationExercise, { type: T }>;
  sources: Source[];
  value: Extract<ExerciseAnswer, { type: T }>;
  onChange: (v: Extract<ExerciseAnswer, { type: T }>) => void;
  /** The checked feedback (null before checking): it colours the fields. */
  feedback: ExerciseFeedback | null;
  /** True while checking and after: nothing can be edited. */
  disabled: boolean;
};
/** Marking inputs share the screen's marker (it also drives the source above them). */
export type MarkerInputProps<T extends ConsolidationType> = InputProps<T> & { marker: PanelMarker };

/** Longest text a field takes (the evaluation endpoint's limit). */
export const MAX_CHARS = 3000;

export const verdictOf = (feedback: ExerciseFeedback | null, key: string): Verdict | undefined =>
  feedback?.items.find((i) => i.key === key)?.verdict;

/** A field's caption (types mockup `label.fl`) above its control. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <AppText role="label" color="textMuted">
        {label}
      </AppText>
      {children}
    </View>
  );
}

/** The quoted source text of a mark, as written in the source (its own spacing and punctuation). */
export function useMarkText(sources: Source[]) {
  const words = useMemo(() => new Map(sources.map((s) => [s.id, { body: s.body, words: tokenizeSource(s.body).words }])), [sources]);
  return (m: Mark) => {
    const t = words.get(m.sourceId);
    const first = t?.words[m.from];
    const last = t?.words[m.to];
    return t && first && last ? t.body.slice(first.start, last.end) : '';
  };
}

const plain = (m: MarkerMark): Mark => ({ sourceId: m.sourceId, from: m.from, to: m.to });

/**
 * Keeps the answer in step with the marker: whenever its marks change, `toAnswer` builds the new answer.
 * (The marker is shared with the source above, so the marks can't live in the answer alone.)
 */
export function useMarksAnswer<A>(marks: MarkerMark[], toAnswer: (marks: (pen: MarkerMark['pen']) => Mark[]) => A, value: A, onChange: (a: A) => void) {
  useEffect(() => {
    const next = toAnswer((pen) => marks.filter((m) => m.pen === pen).map(plain));
    if (JSON.stringify(next) !== JSON.stringify(value)) onChange(next);
    // Only a change of the marks re-derives the answer; the text parts change through onChange directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marks]);
}

/** The mark verdict colours from the feedback, for the slot at this index in the marker's marks. */
export function slotVerdict(feedback: ExerciseFeedback | null, marks: MarkerMark[]) {
  return (i: number): Verdict | null => {
    const m = marks[i];
    if (!m || !feedback?.marks) return null;
    return feedback.marks.find((x) => x.sourceId === m.sourceId && x.from === m.from && x.to === m.to)?.verdict ?? null;
  };
}

const styles = StyleSheet.create({
  field: { gap: space[1.5] },
});
