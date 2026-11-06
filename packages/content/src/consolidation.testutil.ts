import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import {
  exerciseFromRow,
  sourceFromRow,
  type AiContext,
  type ConsolidationExercise,
  type ConsolidationRow,
  type Source,
  type SourceLabel,
} from '@prepio/shared';
import { essayFromWriting, writeConsolidation } from './consolidation';
import { seed } from './seed';
import { TEMPLATES } from './templates';
import type { SeedConsolidation, SeedLesson } from './types';

export type StoredConsolidation = {
  sources: Source[];
  exercises: Array<{ exercise: ConsolidationExercise; ai: AiContext | null }>;
};

/** Reads a lesson's sources and exercises (with their source links and AI contexts) back through the shared model. */
export async function loadConsolidation(client: SupabaseClient, lessonId: string): Promise<StoredConsolidation> {
  const src = await client.from('sources').select('*').eq('lesson_id', lessonId).order('position');
  if (src.error) throw src.error;
  const ex = await client
    .from('consolidation_exercises')
    .select('id,position,type,prompt,content,template_id,consolidation_exercise_sources(source_id,label,position),consolidation_ai_context(context)')
    .eq('lesson_id', lessonId)
    .order('position');
  if (ex.error) throw ex.error;
  type Row = ConsolidationRow & {
    consolidation_exercise_sources: { source_id: string; label: SourceLabel; position: number }[];
    consolidation_ai_context: { context: AiContext } | { context: AiContext }[] | null;
  };
  return {
    sources: src.data.map(sourceFromRow),
    exercises: (ex.data as unknown as Row[]).map((r) => {
      const links = [...r.consolidation_exercise_sources].sort((a, b) => a.position - b.position);
      const ctx = Array.isArray(r.consolidation_ai_context) ? r.consolidation_ai_context[0] : r.consolidation_ai_context;
      return {
        exercise: exerciseFromRow(r, links.map((l) => ({ sourceId: l.source_id, label: l.label }))),
        ai: ctx?.context ?? null,
      };
    }),
  };
}

/**
 * The former writing exercises of each seed lesson (by key), as the consolidation migration converted them: what
 * production held before `add-consolidation`. Criteria shortened; the shape is what matters.
 */
export const MIGRATED_ESSAYS: Record<string, SeedConsolidation[]> = {
  'unirea-principatelor-cuza': [
    essayFromWriting(
      'Scrie introducerea unui eseu despre constituirea statului român modern în perioada 1857–1866.',
      'Contextualizarea temei, enunțarea temei și anunțarea ideilor cuprinsului.',
    ),
    essayFromWriting(
      'Prezintă o acțiune desfășurată de români în perioada 1857–1859, precizând două informații referitoare la aceasta și utilizând relația cauză-efect.',
      'O acțiune din 1857–1859, două informații corecte și relația cauză-efect.',
    ),
  ],
  'constitutia-1866': [
    essayFromWriting(
      'Precizează o măsură adoptată în statul român în perioada 1861–1866 și menționează două aspecte cu privire la această măsură.',
      'O măsură din 1861–1866 și două aspecte corecte, distincte.',
    ),
    essayFromWriting(
      'Formulează un punct de vedere referitor la Constituția din 1866 și susține-l printr-un argument istoric.',
      'Un punct de vedere despre Constituția din 1866, susținut de un fapt istoric relevant, cu conectori.',
    ),
  ],
  'independenta-relatii-internationale': [
    essayFromWriting(
      'Menționează două fapte istorice la care participă România în cadrul relațiilor internaționale din perioada 1875–1885.',
      'Două fapte de politică externă din 1875–1885, corecte și diferite.',
    ),
    essayFromWriting(
      'Formulează un punct de vedere referitor la politica externă a României în perioada 1916–1918 și susține-l printr-un argument istoric.',
      'Un punct de vedere despre politica externă din 1916–1918, susținut de un fapt istoric relevant, cu conectori.',
    ),
  ],
};

/**
 * Production right after the consolidation migration: every seed lesson holds only its converted essays (from
 * position 0), no source; the seed templates are gone. Starts from a reset seed.
 */
export async function toMigratedState(client: SupabaseClient, lessons: SeedLesson[]): Promise<void> {
  await seed(client, { reset: true });
  for (const l of lessons) {
    const { data, error } = await client.from('lessons').select('id').eq('title', l.title).single();
    if (error) throw error;
    const ex = await client.from('consolidation_exercises').delete().eq('lesson_id', data.id);
    if (ex.error) throw ex.error;
    const src = await client.from('sources').delete().eq('lesson_id', data.id);
    if (src.error) throw src.error;
    await writeConsolidation(client, data.id, [], MIGRATED_ESSAYS[l.key] ?? [], new Map(), randomUUID);
  }
  const tpl = await client.from('solution_templates').delete().in('title', TEMPLATES.map((t) => t.title));
  if (tpl.error) throw tpl.error;
}
