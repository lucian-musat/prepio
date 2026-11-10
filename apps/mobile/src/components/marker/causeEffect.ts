export type Role = 'cause' | 'effect';

type RoleCopy = {
  step: 1 | 2;
  eyebrow: string;
  /** The role as a question: what the student looks for in the source. */
  question: string;
  /** The answer gap's caption. */
  gap: string;
  /** Before the signal words (consolidation only). */
  help: string;
  clues: string[];
  /** The pill before a marked text. */
  label: 'CAUZĂ' | 'EFECT';
  name: 'Cauza' | 'Efectul';
};

/** The cause-effect copy (spec 2026-11-10): the step banner, the gaps, the in-text labels. */
export const ROLE: Record<Role, RoleCopy> = {
  cause: {
    step: 1,
    eyebrow: 'Pasul 1 din 2 · marchezi cauza',
    question: 'De ce s-a întâmplat ceva?',
    gap: 'Cauza · de ce?',
    help: 'Caută motivul. Stă de obicei după:',
    clues: ['fiindcă', 'deoarece', 'pentru că', 'cu scopul de a'],
    label: 'CAUZĂ',
    name: 'Cauza',
  },
  effect: {
    step: 2,
    eyebrow: 'Pasul 2 din 2 · marchezi efectul',
    question: 'Ce s-a întâmplat din cauza asta?',
    gap: 'Efectul · ce a urmat?',
    help: 'Caută urmarea. Stă de obicei după:',
    clues: ['ca urmare', 'astfel', 'ceea ce', 'de aceea'],
    label: 'EFECT',
    name: 'Efectul',
  },
};

export const DONE = '✓ Gata, ambele roluri marcate';

const trim = (s: string) => s.trim().replace(/[.,;:]$/, '');

/** „Pentru că ‹cauza›, ‹efectul›.”: the marks as written (no case change: they often start with a proper noun). */
export function relationSentence(cause: string, effect: string): string {
  return `Pentru că ${trim(cause)}, ${trim(effect)}.`;
}
