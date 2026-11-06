import type { SupabaseClient } from '@supabase/supabase-js';
import {
  exerciseFromRow,
  sourceFromRow,
  type AiContext,
  type ConsolidationExercise,
  type ConsolidationRow,
  type Source,
  type SourceLabel,
} from '@prepio/shared';

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
