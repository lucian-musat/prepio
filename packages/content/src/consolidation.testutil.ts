import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import {
  exerciseFromRow,
  sourceFromRow,
  type AiContext,
  type AiTemplateType,
  type ConsolidationExercise,
  type ConsolidationRow,
  type Source,
  type SourceLabel,
} from '@prepio/shared';
import { ensureAiTemplates, essayFromWriting, writeConsolidation } from './consolidation';
import { seed } from './seed';
import { TEMPLATES } from './templates';
import type { SeedAiContext, SeedConsolidation, SeedLesson } from './types';

export type StoredConsolidation = {
  sources: Source[];
  /** `ai` is the stored context with the template ids of the exercise's AI template links; null without a context. */
  exercises: Array<{ exercise: ConsolidationExercise; ai: AiContext | null }>;
};

/** Reads a lesson's sources and exercises (with source links, AI contexts and AI template links) back through the shared model. */
export async function loadConsolidation(client: SupabaseClient, lessonId: string): Promise<StoredConsolidation> {
  const src = await client.from('sources').select('*').eq('lesson_id', lessonId).order('position');
  if (src.error) throw src.error;
  const ex = await client
    .from('consolidation_exercises')
    .select(
      'id,position,type,prompt,content,template_id,consolidation_exercise_sources(source_id,label,position),consolidation_ai_context(context),' +
        'consolidation_ai_template_links(requirement_id,template_id)',
    )
    .eq('lesson_id', lessonId)
    .order('position');
  if (ex.error) throw ex.error;
  type Row = ConsolidationRow & {
    consolidation_exercise_sources: { source_id: string; label: SourceLabel; position: number }[];
    consolidation_ai_context: { context: SeedAiContext } | { context: SeedAiContext }[] | null;
    consolidation_ai_template_links: { requirement_id: string; template_id: string }[];
  };
  return {
    sources: src.data.map(sourceFromRow),
    exercises: (ex.data as unknown as Row[]).map((r) => {
      const links = [...r.consolidation_exercise_sources].sort((a, b) => a.position - b.position);
      const ctx = Array.isArray(r.consolidation_ai_context) ? r.consolidation_ai_context[0] : r.consolidation_ai_context;
      const templates = r.consolidation_ai_template_links;
      return {
        exercise: exerciseFromRow(r, links.map((l) => ({ sourceId: l.source_id, label: l.label }))),
        ai: ctx
          ? {
              ...ctx.context,
              templateId: templates.find((t) => t.requirement_id === '')?.template_id ?? null,
              requirementTemplates: Object.fromEntries(templates.filter((t) => t.requirement_id !== '').map((t) => [t.requirement_id, t.template_id])),
            }
          : null,
      };
    }),
  };
}

/** The ids of the seed AI templates in the database (by title), by type. */
export async function aiTemplateIdsIn(client: SupabaseClient): Promise<Map<AiTemplateType, string>> {
  return (await ensureAiTemplates(client, false)).ids;
}

/** Seed AI template id → type, to check which template an exercise got. */
export async function aiTemplateTypes(client: SupabaseClient): Promise<Map<string, AiTemplateType>> {
  return new Map([...(await aiTemplateIdsIn(client))].map(([type, id]) => [id, type]));
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
 * position 0), no source; the seed templates are gone. Starts from a reset seed. The seed AI templates stay and the essays
 * link to them (linking production's existing AI exercises is a separate content step).
 */
export async function toMigratedState(client: SupabaseClient, lessons: SeedLesson[]): Promise<void> {
  await seed(client, { reset: true });
  const aiIds = await aiTemplateIdsIn(client);
  for (const l of lessons) {
    const { data, error } = await client.from('lessons').select('id').eq('title', l.title).single();
    if (error) throw error;
    const ex = await client.from('consolidation_exercises').delete().eq('lesson_id', data.id);
    if (ex.error) throw ex.error;
    const src = await client.from('sources').delete().eq('lesson_id', data.id);
    if (src.error) throw src.error;
    await writeConsolidation(client, data.id, [], MIGRATED_ESSAYS[l.key] ?? [], new Map(), aiIds, randomUUID);
  }
  const tpl = await client.from('solution_templates').delete().in('title', TEMPLATES.map((t) => t.title));
  if (tpl.error) throw tpl.error;
}
