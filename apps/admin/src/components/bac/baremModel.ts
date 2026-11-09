import { DEFAULT_ESSAY_STYLE, type BacBarem, type BacEssayStyle, type BacStepRule } from '@prepio/shared';

/** A barem rule as the form edits it: steps stay the raw comma-separated text until saved. */
export type RuleDraft = { text: string; steps: string };
export type RequirementDraft = RuleDraft & { points: string };
export type BaremDraft = RuleDraft & { requirements: Record<string, RequirementDraft>; style: BacEssayStyle };

export const STEPS_ERROR = 'Treptele de punctaj trebuie să fie numere întregi, separate prin virgulă.';

export const formatSteps = (steps: number[] | null): string => (steps ? steps.join(', ') : '');

/** Empty = every integer (null); undefined = not a comma-separated list of integers. */
export function parseSteps(s: string): number[] | null | undefined {
  if (s.trim() === '') return null;
  const parts = s.split(',').map((p) => p.trim());
  if (parts.some((p) => !/^\d+$/.test(p))) return undefined;
  return [...new Set(parts.map(Number))].sort((a, b) => a - b);
}

export function baremToDraft(b: BacBarem | undefined): BaremDraft {
  const requirements: Record<string, RequirementDraft> = {};
  for (const [id, r] of Object.entries(b?.essay?.requirements ?? {})) {
    requirements[id] = { text: r.text, steps: formatSteps(r.steps), points: String(r.points) };
  }
  return {
    text: b?.text ?? '',
    steps: formatSteps(b?.steps ?? null),
    requirements,
    style: { ...(b?.essay?.style ?? DEFAULT_ESSAY_STYLE) },
  };
}

const toInt = (s: string) => (/^\s*\d+\s*$/.test(s) ? Number(s) : 0);

/** Sum of the points of the given essay requirements. */
export const essayRequirementPoints = (d: BaremDraft, ids: string[]) =>
  ids.reduce((t, id) => t + toInt(d.requirements[id]?.points ?? ''), 0);

export const stylePoints = (s: BacEssayStyle) => s.language + s.structure + s.order + s.length;

/** `requirementIds` null = not an essay. */
export function draftToBarem(d: BaremDraft, points: number, requirementIds: string[] | null): { barem: BacBarem } | { error: string } {
  const steps = parseSteps(d.steps);
  if (steps === undefined) return { error: STEPS_ERROR };
  if (requirementIds === null) return { barem: { text: d.text, points, steps, essay: null } };
  const requirements: Record<string, BacStepRule> = {};
  for (const id of requirementIds) {
    const r = d.requirements[id] ?? { text: '', steps: '', points: '' };
    const rSteps = parseSteps(r.steps);
    if (rSteps === undefined) return { error: STEPS_ERROR };
    requirements[id] = { text: r.text, points: toInt(r.points), steps: rSteps };
  }
  return { barem: { text: d.text, points, steps, essay: { requirements, style: { ...d.style } } } };
}
