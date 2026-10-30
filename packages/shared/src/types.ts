export type Difficulty = 'easy' | 'medium' | 'hard';
export type QuestionType = 'single_choice' | 'multiple_choice' | 'chronological_order';

export type ChoiceOption = { id: string; text: string; correct: boolean };
/** Stored in the correct (chronological) order. */
export type OrderItem = { id: string; text: string; label?: string };

export type QuestionBase = {
  id: string;
  position: number;
  prompt: string;
  difficulty: Difficulty;
  explanation: string | null;
};

export type Question = QuestionBase &
  (
    | { type: 'single_choice' | 'multiple_choice'; options: ChoiceOption[] }
    | { type: 'chronological_order'; options: OrderItem[] }
  );

export type Answer =
  | { type: 'single_choice' | 'multiple_choice'; selected: string[] }
  | { type: 'chronological_order'; order: string[] };

export type Card = {
  id: string;
  position: number;
  title: string | null;
  body: string;
  imagePath: string | null;
  imageCredit: string | null;
};

export type WritingExercise = { id: string; position: number; prompt: string; criteria: string };

export type LessonStatus = 'draft' | 'published';
export type LessonSummary = { id: string; nodeId: string; title: string; position: number };
export type Lesson = LessonSummary & {
  status: LessonStatus;
  cards: Card[];
  questions: Question[];
  exercises: WritingExercise[];
};

export type TreeNode = { id: string; parentId: string | null; title: string; position: number };

export type EvaluateRequest = { exerciseId: string; text: string };
export type EvaluateResponse = {
  grade: number;
  gradeMin: number;
  gradeMax: number;
  summary: string;
  suggestions: string[];
};
export type EvaluateErrorCode =
  | 'empty'
  | 'too_long'
  | 'not_found'
  | 'rate_limited'
  | 'ai_failed'
  | 'bad_request';
/** `message` is in Romanian. */
export type EvaluateError = { error: EvaluateErrorCode; message: string };

/** Omit fields from every member of a union (plain `Omit` collapses unions). */
export type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;

export const MAX_ESSAY_CHARS = 3000;

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'ușor',
  medium: 'mediu',
  hard: 'dificil',
};
