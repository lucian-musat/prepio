import type { SupabaseClient } from '@supabase/supabase-js';
import { AI_TEMPLATE_TYPES, aiTemplateFromRow, type AiTemplate } from '@prepio/shared';
import { GENERIC_ERROR, UserError, check, checkAffected } from './db';

export type AiTemplateWithUsage = AiTemplate & { usage: number };

const COLUMNS = 'id,title,type,criteria,keywords,response_format';

/** Template id -> number of distinct exercises that link it. */
async function usageCounts(db: SupabaseClient): Promise<Map<string, number>> {
  const rows = check(await db.from('consolidation_ai_template_links').select('exercise_id,template_id')) as unknown as Array<{
    exercise_id: string;
    template_id: string;
  }>;
  const perTemplate = new Map<string, Set<string>>();
  for (const r of rows) {
    const set = perTemplate.get(r.template_id) ?? new Set<string>();
    set.add(r.exercise_id);
    perTemplate.set(r.template_id, set);
  }
  return new Map([...perTemplate].map(([id, set]) => [id, set.size]));
}

export async function listAiTemplates(db: SupabaseClient): Promise<AiTemplateWithUsage[]> {
  const [rows, counts] = await Promise.all([db.from('ai_templates').select(COLUMNS).order('title').order('id'), usageCounts(db)]);
  const list = (check(rows) as Record<string, unknown>[]).map((r) => {
    const t = aiTemplateFromRow(r);
    return { ...t, usage: counts.get(t.id) ?? 0 };
  });
  // Stable sort keeps the title order inside a type.
  return list.sort((a, b) => AI_TEMPLATE_TYPES.indexOf(a.type) - AI_TEMPLATE_TYPES.indexOf(b.type));
}

export async function saveAiTemplate(db: SupabaseClient, input: Omit<AiTemplate, 'id'> & { id?: string }): Promise<{ id: string }> {
  if (typeof input?.title !== 'string' || typeof input.criteria !== 'string' || !AI_TEMPLATE_TYPES.includes(input.type)) {
    throw new UserError(GENERIC_ERROR);
  }
  const fields = {
    title: input.title.trim(),
    type: input.type,
    criteria: input.criteria.trim(),
    keywords: typeof input.keywords === 'string' ? input.keywords.trim() : '',
    response_format: typeof input.responseFormat === 'string' ? input.responseFormat.trim() : '',
  };
  const errors: string[] = [];
  if (fields.title === '') errors.push('Titlul nu poate fi gol.');
  if (fields.criteria === '') errors.push('Completează ce urmărește AI-ul în răspuns.');
  if (errors.length) throw new UserError(errors.join(' '));
  if (input.id) {
    checkAffected(await db.from('ai_templates').update(fields).eq('id', input.id).select('id'));
    return { id: input.id };
  }
  const created = check(await db.from('ai_templates').insert(fields).select('id').single());
  return { id: created!.id as string };
}

const IN_USE = 'Șablonul AI este folosit de un exercițiu.';

export async function deleteAiTemplate(db: SupabaseClient, id: string): Promise<void> {
  if (((await usageCounts(db)).get(id) ?? 0) > 0) throw new UserError(IN_USE);
  const res = await db.from('ai_templates').delete().eq('id', id).select('id');
  if (res.error?.code === '23503') throw new UserError(IN_USE); // a link appeared in between (FK on delete restrict)
  checkAffected(res);
}
