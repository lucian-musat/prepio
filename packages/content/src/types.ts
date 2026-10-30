import type { Card, DistributiveOmit, Question, WritingExercise } from '@prepio/shared';

export type SeedNode = { key: string; title: string; children?: SeedNode[] };

/** A card as authored in the content package; `image` is a file name inside `images/`. */
export type SeedCard = Omit<Card, 'id' | 'position' | 'imagePath'> & { image?: string };

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
