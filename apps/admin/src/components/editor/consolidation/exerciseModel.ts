import {
  emptyExerciseContent, type AiContext, type ConsolidationExercise, type ConsolidationType, type SolutionTemplate, type Source, type SourceLabel,
} from '@prepio/shared';
import type { ExerciseInput } from '@/lib/data/consolidation';
import { plural } from './plural';

/** The form edits an `ExerciseInput` directly; list fields keep raw lines until `cleanDraft`. */
export type ExerciseDraft = ExerciseInput;
export type DraftOf<T extends ConsolidationType> = Extract<ExerciseDraft, { type: T }>;

const EMPTY_AI = (): AiContext => ({ main: '', requirements: {} });

export function draftFor(type: ConsolidationType, newId: () => string): ExerciseDraft {
  return {
    prompt: '',
    templateId: null,
    sources: [],
    modelAnswer: null,
    explanation: null,
    ai: EMPTY_AI(),
    ...emptyExerciseContent(type, newId),
  } as ExerciseDraft;
}

/** Keeps the id, prompt, sources, template, model answer, explanation and AI main context; resets the type fields. */
export function changeType(draft: ExerciseDraft, type: ConsolidationType, newId: () => string): ExerciseDraft {
  return {
    ...(draft.id ? { id: draft.id } : {}),
    prompt: draft.prompt,
    templateId: draft.templateId,
    sources: draft.sources,
    modelAnswer: draft.modelAnswer,
    explanation: draft.explanation,
    ai: { main: draft.ai.main, requirements: {} },
    ...emptyExerciseContent(type, newId),
  } as ExerciseDraft;
}

export function toDraft(ex: ConsolidationExercise, ai: AiContext): ExerciseDraft {
  const copy: Partial<ConsolidationExercise> = { ...ex };
  delete copy.position;
  return { ...copy, ai } as ExerciseDraft;
}

const COMMON = new Set(['id', 'prompt', 'templateId', 'sources', 'modelAnswer', 'explanation', 'ai']);

// Key-sorted, id-free form of a value, so drafts compare with fresh empty content.
const normalize = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(normalize)
    : v !== null && typeof v === 'object'
      ? Object.fromEntries(
          Object.entries(v).filter(([k]) => k !== 'id').sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, normalize(x)]),
        )
      : v;

const typeFields = (d: object) => Object.fromEntries(Object.entries(d).filter(([k]) => !COMMON.has(k)));

/** True when the type-specific fields differ from that type's empty content (switching type would lose them). */
export function hasTypeContent(draft: ExerciseDraft): boolean {
  const empty = emptyExerciseContent(draft.type, () => '');
  return JSON.stringify(normalize(typeFields(draft))) !== JSON.stringify(normalize(empty));
}

const lines = (a: string[]) => a.map((x) => x.trim()).filter((x) => x !== '');
const orNull = (s: string | null) => (s && s.trim() !== '' ? s.trim() : null);

/** What the form sends: list lines trimmed and empty ones dropped, empty optional texts as null. */
export function cleanDraft(d: ExerciseDraft): ExerciseDraft {
  const base = { ...d, modelAnswer: orNull(d.modelAnswer), explanation: orNull(d.explanation) };
  switch (base.type) {
    case 'short_answer':
      return { ...base, accepted: lines(base.accepted), mistakes: base.mistakes.filter((m) => m.answer.trim() !== '') };
    case 'multi_answer':
      return { ...base, groups: base.groups.map((g) => ({ ...g, variants: lines(g.variants) })) };
    case 'essay': {
      const ids = new Set(base.requirements.map((r) => r.id));
      const requirements = Object.fromEntries(Object.entries(base.ai.requirements).filter(([id]) => ids.has(id)));
      return {
        ...base,
        requirements: base.requirements.map((r) => ({ ...r, modelAnswer: orNull(r.modelAnswer) })),
        ai: { ...base.ai, requirements },
      };
    }
    default:
      return base;
  }
}

/** Textarea helpers: one item per line, kept raw while editing so typing isn't disturbed. */
export const joinLines = (a: string[]) => a.join('\n');
export const splitLines = (s: string) => (s === '' ? [] : s.split('\n'));

/** Props of a type's field group in the exercise form. */
export type FieldsProps<T extends ConsolidationType> = {
  /** Unique per form; prefix for element ids. */
  idPrefix: string;
  draft: DraftOf<T>;
  onChange: (next: DraftOf<T>) => void;
  /** The exercise's chosen sources, resolved, in label order (A, B). */
  sources: Array<{ label: SourceLabel; source: Source }>;
  /** All solution templates (the essay's requirements pick their own). */
  templates: SolutionTemplate[];
};

/** The source's title, or its first words. */
export function sourceName(s: Source): string {
  if (s.title && s.title.trim()) return s.title.trim();
  const words = s.body.trim().split(/\s+/);
  return words.length > 8 ? `${words.slice(0, 8).join(' ')}…` : words.join(' ');
}

/** „1 exercițiu”, „2 exerciții”, „20 de exerciții”. */
export const exercisesCount = (n: number) => plural(n, 'exercițiu', 'exerciții');
