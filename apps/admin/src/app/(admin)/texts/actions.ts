'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/lib/actionResult';
import { GENERIC_ERROR, UserError } from '@/lib/data/db';
import { listUiTexts, resetUiText, saveUiText, type UiTextRow } from '@/lib/data/uiTexts';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerClient } from '@/lib/supabase/server';
import { captureError } from '@/lib/sentry';

async function run(label: string, fn: (db: Awaited<ReturnType<typeof createServerClient>>) => Promise<void>): Promise<ActionResult<UiTextRow[]>> {
  try {
    const db = await createServerClient();
    // Explicit admin proof: a non-admin write matches 0 rows silently under RLS, and the service client below
    // bypasses RLS (it only resolves editor emails).
    const { data: isAdmin, error } = await db.rpc('is_admin');
    if (error || isAdmin !== true) throw new UserError('Nu ai drepturi de administrator.');
    await fn(db);
    const data = await listUiTexts(db, createAdminClient());
    revalidatePath('/texts');
    return { ok: true, data };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    console.error(`[${label}] unexpected error:`, e);
    captureError(e, { route: label });
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function saveUiTextAction(key: string, value: string): Promise<ActionResult<UiTextRow[]>> {
  return run('ui text save action', (db) => saveUiText(db, key, value));
}

export async function resetUiTextAction(key: string): Promise<ActionResult<UiTextRow[]>> {
  return run('ui text reset action', (db) => resetUiText(db, key));
}
