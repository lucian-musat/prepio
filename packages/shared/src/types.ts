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

export type CardType = 'text' | 'images' | 'video' | 'timeline' | 'schema' | 'link';
export type CardImage = { path: string; alt: string; credit: string | null };
export type TimelinePoint = {
  id: string;
  date: string;
  title: string;
  details: string | null;
  key: boolean;
  imagePath: string | null;
};
export type SchemaBox = { id: string; text: string; detail: string | null };
export type LinkImage = { kind: 'url'; url: string } | { kind: 'path'; path: string };
/**
 * `display: 'single'` = every image shown large, stacked; `'gallery'` = one main image + thumbnails.
 * A one-image card renders the same in both.
 */
export type CardContent =
  | { type: 'text'; text: string }
  | { type: 'images'; images: CardImage[]; display: 'single' | 'gallery'; text: string | null }
  | {
      type: 'video';
      youtubeId: string;
      startSeconds: number | null;
      endSeconds: number | null;
      text: string | null;
    }
  | { type: 'timeline'; points: TimelinePoint[] }
  | {
      type: 'schema';
      causesLabel: string;
      consequencesLabel: string;
      causes: SchemaBox[];
      central: SchemaBox;
      consequences: SchemaBox[];
    }
  | {
      type: 'link';
      url: string;
      pageTitle: string;
      description: string | null;
      image: LinkImage | null;
      text: string | null;
    };
export type Card = { id: string; position: number; title: string | null } & CardContent;
/** A `cards` table row; `content` is untrusted JSON (everything in `Card` except id/position/title/type). */
export type CardRow = {
  id: string;
  position: number;
  title: string | null;
  type: CardType;
  content: Record<string, unknown>;
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
  | 'bad_request'
  | 'unauthorized';
/** `message` is in Romanian. */
export type EvaluateError = { error: EvaluateErrorCode; message: string };

/** Error replies of `POST /api/account/delete` (success is 204, no body). */
export type AccountDeleteErrorCode = 'unauthorized' | 'forbidden' | 'bad_request' | 'server_error';
/** `message` is in Romanian. */
export type AccountDeleteError = { error: AccountDeleteErrorCode; message: string };

/** Omit fields from every member of a union (plain `Omit` collapses unions). */
export type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;

export const MAX_ESSAY_CHARS = 3000;

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'ușor',
  medium: 'mediu',
  hard: 'dificil',
};
