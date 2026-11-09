import type { SupabaseClient } from '@supabase/supabase-js';
import { CONSOLIDATION_TYPES, templateFromRow, validateTemplate, type ConsolidationType, type SolutionTemplate } from '@prepio/shared';
import { GENERIC_ERROR, UserError, check, checkAffected } from './db';

export type TemplateWithUsage = SolutionTemplate & { usage: number };

const COLUMNS = 'id,title,exercise_type,points,body';

type Usage = { exercises: number; bac: number };

/** Template ids an exercise row uses: its own and, for an essay, its requirements'. */
function templateIdsOf(r: { type: string; template_id: string | null; content: { requirements?: Array<{ templateId?: unknown }> } }): Set<string> {
  const ids = new Set<string>();
  if (r.template_id) ids.add(r.template_id);
  if (r.type === 'essay' && Array.isArray(r.content?.requirements)) {
    for (const q of r.content.requirements) if (typeof q?.templateId === 'string') ids.add(q.templateId);
  }
  return ids;
}

/** Template id -> number of distinct consolidation exercises and BAC items that use it (as their template or an essay requirement's). */
async function usageCounts(db: SupabaseClient): Promise<Map<string, Usage>> {
  const [exercises, bac] = await Promise.all([
    db.from('consolidation_exercises').select('type,template_id,content').or('template_id.not.is.null,type.eq.essay'),
    db.from('bac_items').select('type,template_id,content').or('template_id.not.is.null,type.eq.essay'),
  ]);
  type Row = Parameters<typeof templateIdsOf>[0];
  const counts = new Map<string, Usage>();
  const add = (rows: Row[], key: keyof Usage) => {
    for (const r of rows) {
      for (const id of templateIdsOf(r)) {
        const u = counts.get(id) ?? { exercises: 0, bac: 0 };
        u[key] += 1;
        counts.set(id, u);
      }
    }
  };
  add(check(exercises) as unknown as Row[], 'exercises');
  add(check(bac) as unknown as Row[], 'bac');
  return counts;
}

export async function listTemplates(db: SupabaseClient): Promise<TemplateWithUsage[]> {
  const [rows, counts] = await Promise.all([
    db.from('solution_templates').select(COLUMNS).order('title').order('id'),
    usageCounts(db),
  ]);
  return (check(rows) as Record<string, unknown>[]).map((r) => {
    const t = templateFromRow(r);
    const u = counts.get(t.id);
    return { ...t, usage: (u?.exercises ?? 0) + (u?.bac ?? 0) };
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
  const u = (await usageCounts(db)).get(id);
  if (u && u.exercises + u.bac > 0) {
    const parts = [
      u.exercises > 0 ? (u.exercises === 1 ? 'un exercițiu' : `${u.exercises} exerciții`) : null,
      u.bac > 0 ? (u.bac === 1 ? 'o cerință BAC' : `${u.bac} cerințe BAC`) : null,
    ].filter(Boolean);
    throw new UserError(`Șablonul este folosit de ${parts.join(' și ')}.`);
  }
  checkAffected(await db.from('solution_templates').delete().eq('id', id).select('id'));
}
