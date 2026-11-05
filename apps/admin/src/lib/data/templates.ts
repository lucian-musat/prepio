import type { SupabaseClient } from '@supabase/supabase-js';
import { CONSOLIDATION_TYPES, templateFromRow, validateTemplate, type ConsolidationType, type SolutionTemplate } from '@prepio/shared';
import { GENERIC_ERROR, UserError, check, checkAffected } from './db';

export type TemplateWithUsage = SolutionTemplate & { usage: number };

const COLUMNS = 'id,title,exercise_type,points,body';

/** Template id -> number of distinct exercises that use it (as the exercise template or an essay requirement's). */
async function usageCounts(db: SupabaseClient): Promise<Map<string, number>> {
  const rows = check(
    await db.from('consolidation_exercises').select('type,template_id,content').or('template_id.not.is.null,type.eq.essay'),
  ) as unknown as Array<{ type: string; template_id: string | null; content: { requirements?: Array<{ templateId?: unknown }> } }>;
  const counts = new Map<string, number>();
  for (const r of rows) {
    const ids = new Set<string>();
    if (r.template_id) ids.add(r.template_id);
    if (r.type === 'essay' && Array.isArray(r.content?.requirements)) {
      for (const q of r.content.requirements) if (typeof q?.templateId === 'string') ids.add(q.templateId);
    }
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

export async function listTemplates(db: SupabaseClient): Promise<TemplateWithUsage[]> {
  const [rows, counts] = await Promise.all([
    db.from('solution_templates').select(COLUMNS).order('title').order('id'),
    usageCounts(db),
  ]);
  return (check(rows) as Record<string, unknown>[]).map((r) => {
    const t = templateFromRow(r);
    return { ...t, usage: counts.get(t.id) ?? 0 };
  });
}

export async function saveTemplate(db: SupabaseClient, input: Omit<SolutionTemplate, 'id'> & { id?: string }): Promise<{ id: string }> {
  const exerciseType: ConsolidationType | null = CONSOLIDATION_TYPES.includes(input?.exerciseType as ConsolidationType)
    ? (input.exerciseType as ConsolidationType)
    : null;
  if (typeof input?.title !== 'string' || typeof input.body !== 'string') throw new UserError(GENERIC_ERROR);
  const fields = {
    title: input.title.trim(),
    exerciseType,
    points: typeof input.points === 'string' ? input.points.trim() : '',
    body: input.body.trim(),
  };
  const errors = validateTemplate(fields);
  if (errors.length) throw new UserError(errors.join(' '));
  const row = { title: fields.title, exercise_type: fields.exerciseType, points: fields.points, body: fields.body };
  if (input.id) {
    checkAffected(await db.from('solution_templates').update(row).eq('id', input.id).select('id'));
    return { id: input.id };
  }
  const created = check(await db.from('solution_templates').insert(row).select('id').single());
  return { id: created!.id as string };
}

export async function deleteTemplate(db: SupabaseClient, id: string): Promise<void> {
  const n = (await usageCounts(db)).get(id) ?? 0;
  if (n > 0) throw new UserError(`Șablonul este folosit de ${n === 1 ? 'un exercițiu' : `${n} exerciții`}.`);
  checkAffected(await db.from('solution_templates').delete().eq('id', id).select('id'));
}
