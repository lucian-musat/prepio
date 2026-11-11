'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/lib/actionResult';
import * as aiTemplates from '@/lib/data/aiTemplates';
import { GENERIC_ERROR, UserError } from '@/lib/data/db';
import { createServerClient } from '@/lib/supabase/server';
import { captureError } from '@/lib/sentry';

type AiTemplateInput = Parameters<typeof aiTemplates.saveAiTemplate>[1];

async function run<T = void>(fn: (db: Awaited<ReturnType<typeof createServerClient>>) => Promise<T>): Promise<ActionResult<T>> {
  try {
    const db = await createServerClient();
    const data = await fn(db);
    revalidatePath('/ai-templates');
    return { ok: true, data };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    console.error('[ai-templates action] unexpected error:', e);
    captureError(e, { route: 'ai-templates action' });
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function saveAiTemplateAction(input: AiTemplateInput): Promise<ActionResult<{ id: string }>> {
  return run((db) => aiTemplates.saveAiTemplate(db, input));
}
export async function deleteAiTemplateAction(id: string): Promise<ActionResult> {
  return run((db) => aiTemplates.deleteAiTemplate(db, id));
}
