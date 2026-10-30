import { unireaPrincipatelor } from './lessons/01-unirea-principatelor';
import { constitutia1866 } from './lessons/02-constitutia-1866';
import { independenta } from './lessons/03-independenta';
import type { SeedLesson } from './types';

export type * from './types';
export { tree } from './tree';
export { aiDefaults, welcomeMessage } from './defaults';

/** Seed lessons, in display order. Card `image` values are file names inside `packages/content/images/`. */
export const lessons: SeedLesson[] = [unireaPrincipatelor, constitutia1866, independenta];
