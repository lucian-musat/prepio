'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/lib/actionResult';
import { GENERIC_ERROR, UserError } from '@/lib/data/db';
import * as templates from '@/lib/data/templates';
import { createServerClient } from '@/lib/supabase/server';

type TemplateInput = Parameters<typeof templates.saveTemplate>[1];

async function run<T = void>(fn: (db: Awaited<ReturnType<typeof createServerClient>>) => Promise<T>): Promise<ActionResult<T>> {
  try {
    const db = await createServerClient();
    const data = await fn(db);
    revalidatePath('/templates');
    return { ok: true, data };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    console.error('[templates action] unexpected error:', e);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function saveTemplateAction(input: TemplateInput): Promise<ActionResult<{ id: string }>> {
  return run((db) => templates.saveTemplate(db, input));
}
export async function deleteTemplateAction(id: string): Promise<ActionResult> {
  return run((db) => templates.deleteTemplate(db, id));
}
