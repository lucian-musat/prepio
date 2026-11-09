import type { ConsolidationExercise, CreditsChange, ExerciseAnswer } from '../consolidation/types';

export type BacSection = 1 | 2 | 3;
/** Points of the four essay style criteria (default 2/1/2/1 = 6). */
export type BacEssayStyle = { language: number; structure: number; order: number; length: number };
/** `steps` null = every integer 0..points; otherwise the only scores the barem allows. */
export type BacStepRule = { text: string; points: number; steps: number[] | null };
/** Stored in `bac_item_barem.barem`; never sent to students. */
export type BacBarem = BacStepRule & { essay: { requirements: Record<string, BacStepRule>; style: BacEssayStyle } | null };
export type BacItem = ConsolidationExercise & { section: BacSection; number: number; points: number };
export type BacSubjectSummary = { id: string; title: string; year: number; variant: string; creditCost: number };
/** By item id. */
export type BacAnswers = Record<string, ExerciseAnswer>;
export type BacPartResult = { key: string; points: number; max: number; feedback: string };
/** Shown to students: feedback is one short sentence and never contains barem text. */
export type BacItemResult = {
  itemId: string;
  section: BacSection;
  number: number;
  points: number;
  max: number;
  feedback: string;
  parts?: BacPartResult[];
};
export type BacAttemptStatus = 'draft' | 'grading' | 'graded' | 'failed';

/** `POST /api/bac/submit`. */
export type BacSubmitRequest = { subjectId: string; answers: BacAnswers };
export type BacSubmitResponse = { attemptId: string; points: number; grade: number; results: BacItemResult[]; credits: CreditsChange };
export type BacSubmitErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'suspended'
  | 'access_required'
  | 'not_found'
  | 'rate_limited'
  | 'insufficient_credits'
  | 'already_grading'
  | 'grading_failed'
  | 'too_long';
export type BacSubmitError = {
  error: BacSubmitErrorCode;
  message: string;
  required?: number;
  balance?: number;
  credits?: CreditsChange;
};
