'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/lib/actionResult';
import { GENERIC_ERROR, UserError } from '@/lib/data/db';
import * as students from '@/lib/data/students';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerClient } from '@/lib/supabase/server';
import { captureError } from '@/lib/sentry';

export async function adjustCreditsAction(userId: string, delta: number, reason: string): Promise<ActionResult<number>> {
  try {
    const db = await createServerClient();
    const balance = await students.adjustCredits(db, userId, delta, reason);
    revalidatePath(`/students/${userId}`);
    return { ok: true, data: balance };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    console.error('[students action] unexpected error:', e);
    captureError(e, { route: 'students action' });
    return { ok: false, error: GENERIC_ERROR };
  }
}

async function run<T>(fn: (db: Awaited<ReturnType<typeof createServerClient>>) => Promise<T>, userId: string): Promise<ActionResult<T>> {
  try {
    const db = await createServerClient();
    const data = await fn(db);
    revalidatePath(`/students/${userId}`);
    revalidatePath('/students');
    return { ok: true, data };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    console.error('[students action] unexpected error:', e);
    captureError(e, { route: 'students action' });
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function suspendStudentAction(userId: string, reason: string): Promise<ActionResult<void>> {
  return run((db) => students.suspendStudent(db, userId, reason), userId);
}

export async function reactivateStudentAction(userId: string): Promise<ActionResult<void>> {
  return run((db) => students.reactivateStudent(db, userId), userId);
}

export async function grantAccessAction(userId: string, months: number, reason: string): Promise<ActionResult<string>> {
  return run((db) => students.grantAccess(db, userId, months, reason), userId);
}

export async function revokeAccessAction(userId: string, reason: string): Promise<ActionResult<void>> {
  return run((db) => students.revokeAccess(db, userId, reason), userId);
}

export async function resetProgressAction(userId: string, lessonId: string | null): Promise<ActionResult<void>> {
  return run((db) => students.resetProgress(db, userId, lessonId), userId);
}

export async function loadMoreEventsAction(userId: string, before: number): Promise<ActionResult<students.StudentEvent[]>> {
  return run((db) => students.getStudentEvents(db, userId, before), userId);
}

/** Deletes the account with the service-role client, after checking through the session that the caller is an admin. */
export async function deleteStudentAction(
  userId: string,
  input: { confirmEmail: string; block: boolean; reason: string },
): Promise<ActionResult<void>> {
  try {
    const db = await createServerClient();
    const { data: isAdmin, error } = await db.rpc('is_admin');
    if (error || isAdmin !== true) throw new UserError('Nu ai drepturi de administrator.');
    await students.deleteStudent(createAdminClient(), userId, input);
    revalidatePath('/students');
    return { ok: true, data: undefined };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    console.error('[students action] unexpected error:', e);
    captureError(e, { route: 'students action' });
    return { ok: false, error: GENERIC_ERROR };
  }
}
