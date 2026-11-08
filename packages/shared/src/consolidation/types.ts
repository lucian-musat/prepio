export type ConsolidationType =
  | 'short_answer'
  | 'multi_answer'
  | 'source_info'
  | 'source_letter'
  | 'cause_effect'
  | 'facts'
  | 'comparison'
  | 'viewpoint'
  | 'argument'
  | 'essay';
export type Verdict = 'ok' | 'almost' | 'no';
export type SourceLabel = 'A' | 'B';
export type Source = { id: string; position: number; title: string | null; author: string; work: string; body: string };
/** Char offsets [start, end) into the source body; `text` = body.slice(start, end) when anchored. Limit null = the sentence. */
export type AnswerSpan = {
  id: string;
  sourceId: string;
  start: number;
  end: number;
  text: string;
  limitStart: number | null;
  limitEnd: number | null;
};
export type SourceRef = { sourceId: string; label: SourceLabel };
export type EssayRequirement = {
  id: string;
  text: string;
  modelAnswer: string | null;
  templateId: string | null;
  argument: boolean;
};
export type ConsolidationContent =
  | { type: 'short_answer'; accepted: string[]; mistakes: { answer: string; message: string }[] }
  | { type: 'multi_answer'; count: number; groups: { id: string; variants: string[] }[] }
  | { type: 'source_info'; count: number; spans: AnswerSpan[] }
  | { type: 'source_letter'; correct: SourceLabel; evidence: AnswerSpan | null }
  | { type: 'cause_effect'; pairs: { id: string; cause: AnswerSpan; effect: AnswerSpan; explanation: string | null }[] }
  | { type: 'facts'; count: number }
  | { type: 'comparison'; variant: 'similarity' | 'difference' }
  | { type: 'viewpoint'; count: number; spans: AnswerSpan[] }
  | { type: 'argument' }
  | { type: 'essay'; requirements: EssayRequirement[] };
export type ConsolidationExercise = {
  id: string;
  position: number;
  prompt: string;
  templateId: string | null;
  sources: SourceRef[];
  modelAnswer: string | null;
  explanation: string | null;
  /** Credits one digital-teacher check costs (AI types only; per requirement for the whole essay). */
  creditCost: number;
} & ConsolidationContent;
export type AiContext = {
  main: string;
  requirements: Record<string, string>;
  /** Selected AI template of a non-essay AI exercise. */
  templateId: string | null;
  /** Selected AI template per essay requirement id. */
  requirementTemplates: Record<string, string>;
};
export type AiTemplateType = 'facts' | 'comparison' | 'viewpoint' | 'argument' | 'essay_requirement';
/** Reusable AI instructions for one kind of AI-checked item (admin library, never sent to students). */
export type AiTemplate = {
  id: string;
  title: string;
  type: AiTemplateType;
  criteria: string;
  keywords: string;
  responseFormat: string;
};
export type SolutionTemplate = {
  id: string;
  title: string;
  exerciseType: ConsolidationType | null;
  points: string;
  body: string;
};
/** Word-index range [from, to] (inclusive) of `tokenizeSource(body).words` of one source. */
export type Mark = { sourceId: string; from: number; to: number };
export type ExerciseAnswer =
  | { type: 'short_answer'; text: string }
  | { type: 'multi_answer'; texts: string[] }
  | { type: 'source_info'; marks: Mark[] }
  | { type: 'source_letter'; letter: SourceLabel | null }
  | { type: 'cause_effect'; cause: Mark | null; effect: Mark | null }
  | { type: 'facts'; texts: string[] }
  | { type: 'comparison'; text: string }
  | { type: 'viewpoint'; text: string; marks: Mark[] }
  | { type: 'argument'; text: string }
  | { type: 'essay'; parts: Record<string, string> };
/** One feedback block; `key` identifies it (e.g. 'answer', 'field-0', 'mark-1', 'fact-0', 'viewpoint', 'support-0', a requirement id). */
export type FeedbackItem = {
  key: string;
  verdict: Verdict;
  title: string;
  good: string[];
  improve: string[];
  ai: boolean;
};
export type ExerciseFeedback = {
  verdict: Verdict | null;
  items: FeedbackItem[];
  fields?: Verdict[]; // per input field (multi_answer, facts)
  marks?: Array<{ sourceId: string; from: number; to: number; verdict: Verdict }>; // underline colours
  swapped?: boolean; // cause_effect roles inverted
  reveal?: string[]; // lines for „Vezi răspunsul / toate informațiile / relațiile”
};
export type ConsolidationRow = {
  id: string;
  position: number;
  type: ConsolidationType;
  prompt: string;
  content: Record<string, unknown>;
  template_id: string | null;
  /** Missing (older selects) = the type default. */
  credit_cost?: number;
};

/** `POST /api/consolidation/evaluate`: asks the AI to judge one item of an AI-checked exercise. */
export type ConsolidationEvaluateRequest = {
  exerciseId: string;
  target: 'exercise' | { requirementId: string };
  answer: ExerciseAnswer;
};
/** What a check cost and the balance after it. */
export type CreditsChange = { spent: number; balance: number };
/** `ai: true` on every item. */
export type ConsolidationEvaluateResponse = { items: FeedbackItem[]; credits: CreditsChange };
export type ConsolidationEvaluateErrorCode =
  | 'empty'
  | 'too_long'
  | 'not_found'
  | 'rate_limited'
  | 'insufficient_credits'
  | 'ai_failed'
  | 'bad_request'
  | 'unauthorized'
  | 'suspended'
  | 'access_required';
/**
 * `message` is in Romanian. `insufficient_credits` carries `required` and `balance`; an `ai_failed` after a successful
 * refund carries `credits` (`spent: 0`).
 */
export type ConsolidationEvaluateError = {
  error: ConsolidationEvaluateErrorCode;
  message: string;
  required?: number;
  balance?: number;
  credits?: CreditsChange;
};
/** Per text field. */
export const MAX_ANSWER_CHARS = 3000;
