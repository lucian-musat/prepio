import type { ExerciseAnswer } from '@prepio/shared';
import MarkSlots from '../marker/MarkSlots';
import { slotVerdict, useMarkText, useMarksAnswer, type MarkerInputProps } from './inputKit';

/** Cauză-efect: „Cauza ↓ a dus la ↓ Efectul”, with „⇅ Inversează rolurile” once both are marked. */
export default function CauseEffectInput({ sources, value, onChange, feedback, disabled, marker }: MarkerInputProps<'cause_effect'>) {
  const textOf = useMarkText(sources);
  const marks = marker.state.marks;
  useMarksAnswer<Extract<ExerciseAnswer, { type: 'cause_effect' }>>(
    marks,
    (of) => ({ type: 'cause_effect', cause: of('cause')[0] ?? null, effect: of('effect')[0] ?? null }),
    value,
    onChange,
  );
  return (
    <MarkSlots
      kind="cause_effect"
      count={2}
      state={marker.state}
      textOf={textOf}
      onOpen={() => {}}
      onRemove={(index) => marker.dispatch({ type: 'remove', index })}
      onSwap={() => marker.dispatch({ type: 'swapRoles' })}
      disabled={disabled}
      verdictOf={slotVerdict(feedback, marks)}
    />
  );
}
