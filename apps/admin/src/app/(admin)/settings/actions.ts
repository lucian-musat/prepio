'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/lib/actionResult';
import { GENERIC_ERROR, UserError } from '@/lib/data/db';
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
