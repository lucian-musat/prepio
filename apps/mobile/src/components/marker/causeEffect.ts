import { t } from '../../texts/store';

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
  /** The pill before a marked text („CAUZĂ” / „EFECT”). */
  label: string;
  /** „Cauza” / „Efectul”. */
  name: string;
};

/** One role's copy; the getters read the texts at use time (admin overrides apply). */
const roleCopy = (role: Role, step: 1 | 2): RoleCopy => ({
  step,
  get eyebrow() {
    return t(`consolidation.causeEffect.${role}.eyebrow`);
  },
  get question() {
    return t(`consolidation.causeEffect.${role}.question`);
  },
  get gap() {
    return t(`consolidation.causeEffect.${role}.gap`);
  },
  get help() {
    return t(`consolidation.causeEffect.${role}.help`);
  },
  get clues() {
    return ([1, 2, 3, 4] as const).map((k) => t(`consolidation.causeEffect.${role}.clue${k}`));
  },
  get label() {
    return t(`consolidation.marker.pill.${role}`);
  },
  get name() {
    return t(`consolidation.marker.slot.${role}`);
  },
});

/** The cause-effect copy (spec 2026-11-10): the step banner, the gaps, the in-text labels. */
export const ROLE: Record<Role, RoleCopy> = { cause: roleCopy('cause', 1), effect: roleCopy('effect', 2) };

/** „✓ Gata, ambele roluri marcate”. */
export const done = () => t('consolidation.causeEffect.done');

const trim = (s: string) => s.trim().replace(/[.,;:]$/, '');

/** „Pentru că ‹cauza›, ‹efectul›.”: the marks as written (no case change: they often start with a proper noun). */
export function relationSentence(cause: string, effect: string): string {
  return t('consolidation.causeEffect.sentence', { cauza: trim(cause), efectul: trim(effect) });
}
