import { useMemo, useReducer, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { space, type BacItem, type ExerciseAnswer } from '@prepio/shared';
import ExerciseInput from '../../components/consolidation/ExerciseInput';
import { initialMarker, markerReducer, type MarkerConfig } from '../../components/marker/markerReducer';
import SourcePanel from '../../components/marker/SourcePanel';
import type { PanelMarker, PanelSource } from '../../components/marker/SourceReader';
import { emptyAnswer, markerConfig, markerMarks, restorable } from '../consolidation/checking';
import BacHint from './BacHint';
import { pointsTail, sourcesNamedIn } from '../../lib/sourcesNamed';

const NO_PENS: MarkerConfig = { pens: [], limits: {} };

type Props = {
  item: BacItem;
  /** The section's sources, lettered within the section. */
  sources: PanelSource[];
  /** The stored answer (none yet: the empty one). */
  value: ExerciseAnswer | undefined;
  onChange: (answer: ExerciseAnswer, empty: ExerciseAnswer) => void;
  /** The item's „Cum rezolv” body, when it has a template. */
  hint: string | null;
  /** Essay requirements: ids of their templates that exist, and opening one. */
  templateIds: Set<string>;
  onOpenTemplate: (templateId: string) => void;
};

/**
 * One item of a BAC paper, written without checks: „{number}.” + prompt + „· 1 punct / 4 puncte / 30 de puncte”, the section's sources
 * (marked in place for the marking types), „💡 Cum rezolv” open, and the type's input. Mount it keyed by the item:
 * the marker starts from the stored answer's marks.
 */
export default function BacItemView({ item, sources, value, onChange, hint, templateIds, onOpenTemplate }: Props) {
  const empty = useMemo(() => emptyAnswer(item), [item]);
  const answer = value && restorable(item, value) ? value : empty;
  const cfg = useMemo(() => markerConfig(item), [item]);
  const reducer = useMemo(() => markerReducer(cfg ?? NO_PENS), [cfg]);
  const [initialMarks] = useState(() => markerMarks(answer));
  const [markState, dispatch] = useReducer(reducer, undefined, () => initialMarker(cfg ?? NO_PENS, initialMarks));
  const marker: PanelMarker | undefined = cfg ? { cfg, state: markState, dispatch } : undefined;

  return (
    <SourcePanel
      sources={sources}
      prompt={item.prompt}
      promptLead={`${item.number}.`}
      promptTail={pointsTail(item.points)}
      preferredLabel={sourcesNamedIn(item.prompt)[0]}
      marker={marker}
    >
      <View style={styles.answer}>
        {hint ? <BacHint body={hint} /> : null}
        <ExerciseInput
          exercise={item}
          sources={sources.map((s) => s.source)}
          value={answer}
          onChange={(v) => onChange(v, empty)}
          feedback={null}
          disabled={false}
          marker={marker}
          templateIds={templateIds}
          onOpenTemplate={onOpenTemplate}
        />
      </View>
    </SourcePanel>
  );
}

const styles = StyleSheet.create({
  answer: { gap: space[3] },
});
