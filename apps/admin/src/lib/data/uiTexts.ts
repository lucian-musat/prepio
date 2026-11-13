import type { SupabaseClient } from '@supabase/supabase-js';
import { isTextKey, TEXTS, validateTextValue, type TextEntry, type TextGroup } from '@prepio/shared';
import { check, UserError, GENERIC_ERROR } from './db';

export type UiTextRow = {
  key: string;
  group: TextGroup | null;
  description?: string;
  vars: string[];
  optional: boolean;
  defaultText: string | null;
  /** The override, or null when the default is in use. */
  value: string | null;
  updatedAt: string | null;
  /** Email of the admin who saved the override (first 8 characters of the id when the email is unknown). */
  updatedBy: string | null;
  /** An override whose key is no longer in the catalog. */
  orphan: boolean;
};

type DbRow = { key: string; value: string; updated_at: string; updated_by: string | null };

/** Editor emails; `serviceDb` (service role, bypasses RLS) is only used for the lookup, may be omitted, and must only be passed for a caller already proven to be an admin. */
async function editorLabels(serviceDb: SupabaseClient | undefined, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  await Promise.all(
    ids.map(async (id) => {
      let label = id.slice(0, 8);
      if (serviceDb) {
        try {
          const got = await serviceDb.auth.admin.getUserById(id);
          label = got.data?.user?.email ?? label;
        } catch {
          // keep the short id
        }
      }
      out.set(id, label);
    }),
  );
  return out;
}

/** Every catalog text (sorted by group, then key) with its override, followed by orphan overrides. */
export async function listUiTexts(db: SupabaseClient, serviceDb?: SupabaseClient): Promise<UiTextRow[]> {
  const rows = check(await db.from('ui_texts').select('key,value,updated_at,updated_by')) as DbRow[];
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const ids = [...new Set(rows.map((r) => r.updated_by).filter((x): x is string => !!x))];
  const labels = await editorLabels(serviceDb, ids);
  const meta = (r: DbRow | undefined) => ({
    value: r?.value ?? null,
    updatedAt: r?.updated_at ?? null,
    updatedBy: r?.updated_by ? (labels.get(r.updated_by) ?? null) : null,
  });

  const catalog: UiTextRow[] = Object.entries(TEXTS as Record<string, TextEntry>)
    .map(([key, e]) => ({
      key,
      group: e.group,
      description: e.description,
      vars: [...(e.vars ?? [])],
      optional: !!e.optional,
      defaultText: e.default,
      orphan: false,
      ...meta(byKey.get(key)),
    }))
    .sort((a, b) => (a.group ?? '').localeCompare(b.group ?? '') || a.key.localeCompare(b.key));

  const orphans: UiTextRow[] = rows
    .filter((r) => !isTextKey(r.key))
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((r) => ({
      key: r.key, group: null, vars: [], optional: false, defaultText: null, orphan: true, ...meta(r),
    }));
  return [...catalog, ...orphans];
}

export async function saveUiText(db: SupabaseClient, key: string, value: string): Promise<void> {
  if (!isTextKey(key)) throw new UserError('Textul nu mai există în aplicație.');
  const entry = (TEXTS as Record<string, TextEntry>)[key]!;
  const problem = validateTextValue(entry, value);
  if (problem) throw new UserError(problem);
  // A whitespace-only value on an optional key means "hide the text": store it as ''.
  if (entry.optional && value.trim() === '') value = '';
  if (value === entry.default) {
    check(await db.from('ui_texts').delete().eq('key', key));
    return;
  }
  const user = await db.auth.getUser();
  const uid = user.data.user?.id;
  if (!uid) throw new UserError(GENERIC_ERROR);
  const saved = check(await db.from('ui_texts').upsert({ key, value, updated_by: uid }, { onConflict: 'key' }).select('key')) as { key: string }[] | null;
  if (!saved?.length) throw new UserError(GENERIC_ERROR);
}

export async function resetUiText(db: SupabaseClient, key: string): Promise<void> {
  check(await db.from('ui_texts').delete().eq('key', key));
}
