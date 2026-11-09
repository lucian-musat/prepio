import type { ConsolidationExercise, ExerciseAnswer, ExerciseFeedback, Source } from '@prepio/shared';
import type { CreditGate } from '../../credits/useCreditGate';
import type { PanelMarker } from '../marker/SourceReader';
import ArgumentInput from './ArgumentInput';
import CauseEffectInput from './CauseEffectInput';
import ComparisonInput from './ComparisonInput';
import EssayInput from './EssayInput';
import FactsInput from './FactsInput';
import LetterInput from './LetterInput';
import MultiAnswerInput from './MultiAnswerInput';
import ShortAnswerInput from './ShortAnswerInput';
import SourceInfoInput from './SourceInfoInput';
import ViewpointInput from './ViewpointInput';

/** The essay's per-requirement checks (consolidation). Without them the essay is only written (a BAC paper). */
export type EssayChecks = {
  onFeedback: (feedback: ExerciseFeedback) => void;
  gate: CreditGate;
  onBusyChange?: (busy: boolean) => void;
};

type Props = {
  exercise: ConsolidationExercise;
  /** The sources the exercise shows (marks and letters refer to them). */
  sources: Source[];
  value: ExerciseAnswer;
  onChange: (v: ExerciseAnswer) => void;
  feedback: ExerciseFeedback | null;
  disabled: boolean;
  /** The screen's marker; required by the marking types (source_info, cause_effect, viewpoint). */
  marker?: PanelMarker;
  /** Ids of the essay requirements' templates that exist; their „💡” calls `onOpenTemplate`. */
  templateIds?: Set<string>;
  onOpenTemplate?: (templateId: string) => void;
  essayChecks?: EssayChecks;
};

/** The input of an exercise's type, controlled by the screen (consolidation exercise, BAC paper item). */
export default function ExerciseInput({ exercise, sources, value, onChange, feedback, disabled, marker, templateIds, onOpenTemplate, essayChecks }: Props) {
  const common = { sources, feedback, disabled, onChange };
  switch (exercise.type) {
    case 'short_answer':
      return <ShortAnswerInput {...common} exercise={exercise} value={value as never} />;
    case 'multi_answer':
      return <MultiAnswerInput {...common} exercise={exercise} value={value as never} />;
    case 'source_info':
      return <SourceInfoInput {...common} exercise={exercise} value={value as never} marker={marker!} />;
    case 'source_letter':
      return <LetterInput {...common} exercise={exercise} value={value as never} />;
    case 'cause_effect':
      return <CauseEffectInput {...common} exercise={exercise} value={value as never} marker={marker!} />;
    case 'facts':
      return <FactsInput {...common} exercise={exercise} value={value as never} />;
    case 'comparison':
      return <ComparisonInput {...common} exercise={exercise} value={value as never} />;
    case 'viewpoint':
      return <ViewpointInput {...common} exercise={exercise} value={value as never} marker={marker!} />;
    case 'argument':
      return <ArgumentInput {...common} exercise={exercise} value={value as never} />;
    case 'essay':
      return (
        <EssayInput
          {...common}
          exercise={exercise}
          value={value as never}
          templateIds={templateIds}
          onOpenTemplate={onOpenTemplate}
          onFeedback={essayChecks?.onFeedback}
          onBusyChange={essayChecks?.onBusyChange}
          gate={essayChecks?.gate}
        />
      );
  }
}
