import type { Card, DistributiveOmit, Question, WritingExercise } from '@prepio/shared';

export type SeedNode = { key: string; title: string; children?: SeedNode[] };

/**
 * A card as authored in the content package. Image paths (`CardImage.path`, `TimelinePoint.imagePath`,
 * `LinkImage.path`) are file names inside `images/`; the seed uploads them under `seed/`.
 */
export type SeedCard = DistributiveOmit<Card, 'id' | 'position'>;

/** Option ids are stable short strings ('a', 'b', ...). */
export type SeedQuestion = DistributiveOmit<Question, 'id' | 'position'>;

export type SeedExercise = Omit<WritingExercise, 'id' | 'position'>;

export type SeedLesson = {
  key: string;
  nodeKey: string;
  title: string;
  status: 'published';
  cards: SeedCard[];
  questions: SeedQuestion[];
  exercises: SeedExercise[];
};

export type AiDefaults = { rules: string; gradeMin: 1; gradeMax: 10; model: 'gpt-5-mini' };
