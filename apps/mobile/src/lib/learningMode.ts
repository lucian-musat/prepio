import type { Profile } from './profile';

export type LearningMode = 'guided' | 'free';

export const DEFAULT_MODE: LearningMode = 'guided';

export const MODE_INFO: Record<LearningMode, { name: string; icon: string; points: string[] }> = {
  guided: {
    name: 'Traseu ghidat',
    icon: '🧭',
    points: [
      'Parcurgi lecțiile în ordine, una după alta.',
      'Lecția următoare se deschide după ce răspunzi corect la toate întrebările.',
      'Dacă greșești, revezi cardurile și reiei testul.',
      'Știi deja materia? Sari direct la verificare.',
    ],
  },
  free: {
    name: 'Explorare liberă',
    icon: '🗺️',
    points: ['Începi orice lecție, în ce ordine vrei.', 'O lecție e terminată când ajungi la final.'],
  },
};

/** The student's mode; falls back to the default when the profile is missing (e.g. offline). */
export const modeOf = (p: Profile | null): LearningMode => p?.learningMode ?? DEFAULT_MODE;
