import { unireaPrincipatelor } from './lessons/01-unirea-principatelor';
import { constitutia1866 } from './lessons/02-constitutia-1866';
import { independenta } from './lessons/03-independenta';
import type { SeedLesson } from './types';

export type * from './types';
export { tree } from './tree';
export { aiDefaults, DEFAULT_BAC_RULES } from './defaults';
export { BAC_SUBJECTS } from './bacSubjects';
export { TEMPLATES } from './templates';
export { AI_TEMPLATES } from './aiTemplates';

/** Seed lessons, in display order. Card image paths are file names inside `packages/content/images/`. */
export const lessons: SeedLesson[] = [unireaPrincipatelor, constitutia1866, independenta];
