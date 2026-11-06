'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/lib/actionResult';
import { GENERIC_ERROR, UserError } from '@/lib/data/db';
import * as credits from '@/lib/data/credits';
import type { CreditSettingsInput } from '@/lib/data/credits';
import * as settings from '@/lib/data/settings';
import type { SettingsInput } from '@/lib/data/settings';
import { createServerClient } from '@/lib/supabase/server';

export async function saveSettings(input: SettingsInput): Promise<ActionResult> {
  try {
    const db = await createServerClient();
    await settings.saveSettings(db, input);
    revalidatePath('/settings');
    return { ok: true };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    console.error('[settings action] unexpected error:', e);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function saveCreditSettingsAction(input: CreditSettingsInput): Promise<ActionResult<CreditSettingsInput>> {
  try {
    const db = await createServerClient();
    await credits.saveCreditSettings(db, input);
    const data = await credits.getCreditSettings(db);
    revalidatePath('/settings');
    return { ok: true, data };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    console.error('[credit settings action] unexpected error:', e);
    return { ok: false, error: GENERIC_ERROR };
  }
}
