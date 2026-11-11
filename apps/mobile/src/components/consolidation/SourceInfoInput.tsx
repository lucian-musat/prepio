import type { ExerciseAnswer } from '@prepio/shared';
import MarkSlots from '../marker/MarkSlots';
import { slotVerdict, useMarkText, useMarksAnswer, type MarkerInputProps } from './inputKit';

/** Informație din sursă: the marked information, one slot per information asked for. */
export default function SourceInfoInput({ exercise, sources, value, onChange, feedback, disabled, marker }: MarkerInputProps<'source_info'>) {
  const textOf = useMarkText(sources);
  const marks = marker.state.marks;
  const numbered = !!marker.cfg.numbered;
  useMarksAnswer<Extract<ExerciseAnswer, { type: 'source_info' }>>(marks, (of) => ({ type: 'source_info', marks: of('info') }), value, onChange);
  return (
    <MarkSlots
      kind="info"
      count={exercise.count}
      numbered={numbered}
      state={marker.state}
      textOf={textOf}
      onOpen={(_pen, _index, slot) => numbered && marker.dispatch({ type: 'setSlot', slot })}
      onRemove={(index) => marker.dispatch({ type: 'remove', index })}
      disabled={disabled}
      verdictOf={slotVerdict(feedback, marks)}
    />
  );
}
