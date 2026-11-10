import type { ExerciseAnswer } from '@prepio/shared';
import CauseEffectRelation from '../marker/CauseEffectRelation';
import { slotVerdict, useMarkText, useMarksAnswer, type MarkerInputProps } from './inputKit';

/** Cauză-efect: „Cauza · de ce?” ↓ a dus la ↓ „Efectul · ce a urmat?”, then „Pentru că X, Y. Are sens?” with ⇅. */
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
    <CauseEffectRelation
      state={marker.state}
      textOf={textOf}
      onRemove={(index) => marker.dispatch({ type: 'remove', index })}
      onSwap={() => marker.dispatch({ type: 'swapRoles' })}
      disabled={disabled}
      verdictOf={slotVerdict(feedback, marks)}
    />
  );
}
