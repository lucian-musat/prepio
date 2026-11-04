import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from './supabase';

/** Where the student left a lesson; `results` maps question id → answered correctly in the current attempt. */
export type LessonPosition = {
  phase: 'cards' | 'questions' | 'exercises';
  index: number;
  results: Record<string, boolean>;
};

export type Progress = { finished: Set<string>; positions: Map<string, LessonPosition> };

const PHASES: ReadonlyArray<LessonPosition['phase']> = ['cards', 'questions', 'exercises'];
const SAVE_FAILED = 'Progresul nu a putut fi salvat. Încearcă din nou.';
const ON_CONFLICT = 'user_id,lesson_id';

/** Parses the stored `position` json; null when it is not a valid position. */
export function positionFromJson(raw: unknown): LessonPosition | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { phase, index, results } = raw as Record<string, unknown>;
  if (!PHASES.includes(phase as LessonPosition['phase'])) return null;
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0) return null;
  if (typeof results !== 'object' || results === null || Array.isArray(results)) return null;
  const clean: Record<string, boolean> = {};
  for (const [id, value] of Object.entries(results)) {
    if (typeof value === 'boolean') clean[id] = value;
  }
  return { phase: phase as LessonPosition['phase'], index, results: clean };
}

/** The student's finished lessons and saved positions (RLS scopes the rows to the student). */
export async function fetchProgress(client: SupabaseClient = getSupabase()): Promise<Progress> {
  const { data, error } = await client.from('lesson_progress').select('lesson_id,finished_at,position');
  if (error) throw error;
  const progress: Progress = { finished: new Set(), positions: new Map() };
  for (const row of data ?? []) {
    if (row.finished_at) progress.finished.add(row.lesson_id);
    const position = positionFromJson(row.position);
    if (position) progress.positions.set(row.lesson_id, position);
  }
  return progress;
}

/** Saves (or clears with null) the position; only `position` changes on conflict, so `finished_at` is kept. */
export async function savePosition(
  lessonId: string,
  position: LessonPosition | null,
  client: SupabaseClient = getSupabase(),
): Promise<void> {
  const { error } = await client
    .from('lesson_progress')
    .upsert({ lesson_id: lessonId, position }, { onConflict: ON_CONFLICT });
  if (error) throw error;
}

/** Marks the lesson finished and clears its saved position. */
export async function markFinished(lessonId: string, client: SupabaseClient = getSupabase()): Promise<void> {
  const { error } = await client
    .from('lesson_progress')
    .upsert({ lesson_id: lessonId, finished_at: new Date().toISOString(), position: null }, { onConflict: ON_CONFLICT });
  if (error) throw new Error(SAVE_FAILED);
}
