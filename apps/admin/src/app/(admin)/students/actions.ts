'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/lib/actionResult';
import { GENERIC_ERROR, UserError } from '@/lib/data/db';
import * as students from '@/lib/data/students';
import { createServerClient } from '@/lib/supabase/server';

export async function adjustCreditsAction(userId: string, delta: number, reason: string): Promise<ActionResult<number>> {
  try {
    const db = await createServerClient();
    const balance = await students.adjustCredits(db, userId, delta, reason);
    revalidatePath(`/students/${userId}`);
    return { ok: true, data: balance };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    console.error('[students action] unexpected error:', e);
    return { ok: false, error: GENERIC_ERROR };
  }
}
