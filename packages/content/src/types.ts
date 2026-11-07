import type { AiContext, Card, ConsolidationType, DistributiveOmit, Question, SourceLabel } from '@prepio/shared';

/** The AI context text an exercise is authored with; the AI template links are set separately. */
export type SeedAiContext = Pick<AiContext, 'main' | 'requirements'>;

export type SeedNode = { key: string; title: string; children?: SeedNode[] };

/**
 * A card as authored in the content package. Image paths (`CardImage.path`, `TimelinePoint.imagePath`,
 * `LinkImage.path`) are file names inside `images/`; the seed uploads them under `seed/`.
 */
export type SeedCard = DistributiveOmit<Card, 'id' | 'position'>;

/** Option ids are stable short strings ('a', 'b', ...). */
export type SeedQuestion = DistributiveOmit<Question, 'id' | 'position'>;

/** A consolidation source of a lesson; exercises and spans refer to it by `key`. */
export type SeedSource = { key: string; title: string | null; author: string; work: string; body: string };

/** Spans are authored as exact quotes from the source body; `toExercise` turns them into offsets (throws if a quote is not found). */
export type SeedSpan = { source: string; quote: string };

export type SeedEssayRequirement = {
  /** Also the key of its AI context in `ai.requirements`. */
  id: string;
  text: string;
  modelAnswer: string | null;
  /** A `SeedTemplate` key. */
  template: string | null;
  argument: boolean;
};

/** Mirrors `ConsolidationContent`, with `SeedSpan` for answer spans; group, pair and span ids are generated. */
export type SeedConsolidationContent =
  | { type: 'short_answer'; accepted: string[]; mistakes: { answer: string; message: string }[] }
  /** Each group is one accepted answer with its variants. */
  | { type: 'multi_answer'; count: number; groups: string[][] }
  | { type: 'source_info'; count: number; spans: SeedSpan[] }
  | { type: 'source_letter'; correct: SourceLabel; evidence: SeedSpan | null }
  | { type: 'cause_effect'; pairs: { cause: SeedSpan; effect: SeedSpan; explanation: string | null }[] }
  | { type: 'facts'; count: number }
  | { type: 'comparison'; variant: 'similarity' | 'difference' }
  | { type: 'viewpoint'; count: number; spans: SeedSpan[] }
  | { type: 'argument' }
  | { type: 'essay'; requirements: SeedEssayRequirement[] };

export type SeedConsolidation = {
  prompt: string;
  /** A `SeedTemplate` key. */
  template: string | null;
  /** Source keys of the lesson, labelled A and B in this order. */
  sources: string[];
  modelAnswer?: string;
  explanation?: string;
  /** Required for the AI-checked types (`main`, or one entry per essay requirement id). */
  ai?: SeedAiContext;
} & SeedConsolidationContent;

export type SeedTemplate = { key: string; title: string; exerciseType: ConsolidationType | null; points: string; body: string };

export type SeedLesson = {
  key: string;
  nodeKey: string;
  title: string;
  status: 'published';
  cards: SeedCard[];
  questions: SeedQuestion[];
  sources: SeedSource[];
  /** In display order. */
  consolidation: SeedConsolidation[];
};

export type AiDefaults = { rules: string; model: 'gpt-5-mini' };
