import type { SupabaseClient } from '@supabase/supabase-js';
import {
  exerciseFromRow,
  sourceFromRow,
  templateFromRow,
  validateExercise,
  type ConsolidationExercise,
  type ConsolidationRow,
  type ExerciseAnswer,
  type ExerciseFeedback,
  type SolutionTemplate,
  type Source,
  type SourceLabel,
  type Verdict,
} from '@prepio/shared';
import { getSupabase } from './supabase';

export type ConsolidationData = {
  lessonId: string;
  exercises: ConsolidationExercise[];
  sources: Map<string, Source>;
  templates: Map<string, SolutionTemplate>;
};

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

/**
 * The lesson's valid consolidation exercises in the admin's order, with the sources and solution templates they
 * reference. Exercises that fail validation (e.g. a span detached from an edited source) are dropped with a warning.
 */
export async function fetchConsolidation(
  lessonId: string,
  client: SupabaseClient = getSupabase(),
): Promise<ConsolidationData> {
  const exRes = await client
    .from('consolidation_exercises')
    .select('*, consolidation_exercise_sources(source_id,label,position)')
    .eq('lesson_id', lessonId)
    .order('position');
  if (exRes.error) throw exRes.error;
  const rows: any[] = [...(exRes.data ?? [])].sort(byPosition);
  if (rows.length === 0) {
    return { lessonId, exercises: [], sources: new Map(), templates: new Map() };
  }

  const exercises: ConsolidationExercise[] = rows.map((r) => {
    const refs = [...(r.consolidation_exercise_sources ?? [])]
      .sort(byPosition)
      .map((s: any) => ({ sourceId: s.source_id as string, label: s.label as SourceLabel }));
    return exerciseFromRow(r as ConsolidationRow, refs);
  });

  const sourceIds = [...new Set(exercises.flatMap((e) => e.sources.map((s) => s.sourceId)))];
  const templateIds = [
    ...new Set(
      exercises.flatMap((e) => [
        ...(e.templateId ? [e.templateId] : []),
        ...(e.type === 'essay' ? e.requirements.flatMap((r) => (r.templateId ? [r.templateId] : [])) : []),
      ]),
    ),
  ];
  const [srcRes, tplRes] = await Promise.all([
    sourceIds.length ? client.from('sources').select('*').in('id', sourceIds) : Promise.resolve({ data: [], error: null }),
    templateIds.length
      ? client.from('solution_templates').select('*').in('id', templateIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (srcRes.error) throw srcRes.error;
  if (tplRes.error) throw tplRes.error;
  const sourceList = (srcRes.data ?? []).map((r: any) => sourceFromRow(r));
  const sources = new Map(sourceList.map((s) => [s.id, s] as const));
  const templates = new Map((tplRes.data ?? []).map((r: any) => templateFromRow(r)).map((t) => [t.id, t] as const));

  const valid = exercises.filter((ex) => {
    const problems = validateExercise(ex, sourceList, null);
    if (problems.length) console.warn(`[consolidation] skipping exercise ${ex.id}: ${problems.join('; ')}`);
    return problems.length === 0;
  });
  return { lessonId, exercises: valid, sources, templates };
}

/** Number of valid exercises (start screen, end screens). */
export async function countConsolidation(lessonId: string, client: SupabaseClient = getSupabase()): Promise<number> {
  return (await fetchConsolidation(lessonId, client)).exercises.length;
}

export type Attempt = { exerciseId: string; answer: ExerciseAnswer; verdict: Verdict | null; feedback: ExerciseFeedback };

/** The student's latest attempt per exercise (RLS scopes the rows to the student). */
export async function fetchAttempts(
  exerciseIds: string[],
  client: SupabaseClient = getSupabase(),
): Promise<Map<string, Attempt>> {
  const map = new Map<string, Attempt>();
  if (exerciseIds.length === 0) return map;
  const { data, error } = await client
    .from('consolidation_attempts')
    .select('exercise_id,answer,verdict,feedback')
    .in('exercise_id', exerciseIds);
  if (error) throw error;
  for (const r of data ?? []) {
    map.set(r.exercise_id, { exerciseId: r.exercise_id, answer: r.answer, verdict: r.verdict, feedback: r.feedback });
  }
  return map;
}

/** Saves the latest attempt of an exercise, overwriting the previous one. */
export async function saveAttempt(a: Attempt, client: SupabaseClient = getSupabase()): Promise<void> {
  const { error } = await client
    .from('consolidation_attempts')
    .upsert(
      { exercise_id: a.exerciseId, answer: a.answer, verdict: a.verdict, feedback: a.feedback },
      { onConflict: 'user_id,exercise_id' },
    );
  if (error) throw error;
}

export type Run = { exerciseIds: string[]; index: number; finished: boolean };

export async function fetchRun(lessonId: string, client: SupabaseClient = getSupabase()): Promise<Run | null> {
  const { data, error } = await client
    .from('consolidation_runs')
    .select('exercise_ids,index,finished_at')
    .eq('lesson_id', lessonId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { exerciseIds: data.exercise_ids ?? [], index: data.index, finished: data.finished_at != null };
}

export async function saveRun(lessonId: string, run: Run, client: SupabaseClient = getSupabase()): Promise<void> {
  const { error } = await client.from('consolidation_runs').upsert(
    {
      lesson_id: lessonId,
      exercise_ids: run.exerciseIds,
      index: run.index,
      finished_at: run.finished ? new Date().toISOString() : null,
    },
    { onConflict: 'user_id,lesson_id' },
  );
  if (error) throw error;
}

export type RunStart = { kind: 'resume'; run: Run } | { kind: 'end' } | { kind: 'new'; run: Run };

/** A run over the valid exercises, from the first; `onlyNotCorrect` keeps those whose latest verdict isn't `ok`. */
export function newRun(valid: string[], attempts: Map<string, Attempt>, onlyNotCorrect: boolean): Run {
  const ids = onlyNotCorrect ? valid.filter((id) => attempts.get(id)?.verdict !== 'ok') : [...valid];
  return { exerciseIds: ids, index: 0, finished: false };
}

/** What opening consolidation shows (spec "Runs"). Unknown/invalid ids are dropped; an emptied run is finished. */
export function resolveRun(valid: string[], run: Run | null, attempts: Map<string, Attempt>): RunStart {
  const attemptedAny = valid.some((id) => attempts.has(id));
  const attemptedAll = valid.every((id) => attempts.has(id));
  if (!run) {
    return attemptedAll ? { kind: 'end' } : { kind: 'new', run: newRun(valid, attempts, false) };
  }
  if (run.finished) return { kind: 'end' };
  const known = new Set(valid);
  const exerciseIds = run.exerciseIds.filter((id) => known.has(id));
  if (exerciseIds.length === 0) {
    return attemptedAny ? { kind: 'end' } : { kind: 'new', run: newRun(valid, attempts, false) };
  }
  // Ids removed before the current one shift it left.
  const keptBefore = run.exerciseIds.slice(0, run.index).filter((id) => known.has(id)).length;
  const index = Math.min(keptBefore, exerciseIds.length - 1);
  return { kind: 'resume', run: { exerciseIds, index, finished: false } };
}

/**
 * The run moved to exercise `index` (previous / next / skip / a tap on the exercise map). Past the last exercise
 * the run is finished: the end screen. It never goes before the first.
 */
export function moveRun(run: Run, index: number): Run {
  if (index >= run.exerciseIds.length) return { ...run, finished: true };
  return { ...run, index: Math.max(0, index), finished: false };
}

/** A full run over the valid exercises positioned at `exerciseId` (a row tapped on the end screen). */
export function runAt(valid: string[], exerciseId: string): Run {
  return { exerciseIds: [...valid], index: Math.max(0, valid.indexOf(exerciseId)), finished: false };
}
