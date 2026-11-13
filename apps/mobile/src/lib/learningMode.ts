import type { Profile } from './profile';
import { t } from '../texts/store';

export type LearningMode = 'guided' | 'free';

export const DEFAULT_MODE: LearningMode = 'guided';

/** Name and points are getters: the texts are read at use time (admin overrides), never at module load. */
export const MODE_INFO: Record<LearningMode, { name: string; icon: string; points: string[] }> = {
  guided: {
    get name() {
      return t('onboarding.mode.guided.name');
    },
    icon: '🧭',
    get points() {
      return [
        t('onboarding.mode.guided.point1'),
        t('onboarding.mode.guided.point2'),
        t('onboarding.mode.guided.point3'),
        t('onboarding.mode.guided.point4'),
      ];
    },
  },
  free: {
    get name() {
      return t('onboarding.mode.free.name');
    },
    icon: '🗺️',
    get points() {
      return [t('onboarding.mode.free.point1'), t('onboarding.mode.free.point2')];
    },
  },
};

/** The student's mode; falls back to the default when the profile is missing (e.g. offline). */
export const modeOf = (p: Profile | null): LearningMode => p?.learningMode ?? DEFAULT_MODE;
