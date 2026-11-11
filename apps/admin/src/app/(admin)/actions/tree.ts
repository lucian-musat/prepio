'use server';

import { revalidatePath } from 'next/cache';
import type { LessonStatus } from '@prepio/shared';
import type { ActionResult } from '@/lib/actionResult';
import { createServerClient } from '@/lib/supabase/server';
import * as tree from '@/lib/data/tree';
import { captureError } from '@/lib/sentry';

async function run<T = void>(fn: (db: Awaited<ReturnType<typeof createServerClient>>) => Promise<T>): Promise<ActionResult<T>> {
  try {
    const db = await createServerClient();
    const data = await fn(db);
    revalidatePath('/');
    return { ok: true, data };
  } catch (e) {
    if (e instanceof tree.UserError) return { ok: false, error: e.message };
    console.error('[tree action] unexpected error:', e);
    captureError(e, { route: 'tree action' });
    return { ok: false, error: 'Operația a eșuat. Încearcă din nou.' };
  }
}

export async function createNode(parentId: string | null, title: string): Promise<ActionResult<{ id: string }>> {
  return run((db) => tree.createNode(db, parentId, title));
}
export async function renameNode(id: string, title: string): Promise<ActionResult> {
  return run((db) => tree.renameNode(db, id, title));
}
export async function moveNode(id: string, direction: 'up' | 'down'): Promise<ActionResult> {
  return run((db) => tree.moveNode(db, id, direction));
}
export async function deleteNode(id: string): Promise<ActionResult> {
  return run((db) => tree.deleteNode(db, id));
}
export async function createLesson(nodeId: string, title: string): Promise<ActionResult<{ id: string }>> {
  return run((db) => tree.createLesson(db, nodeId, title));
}
export async function moveLesson(id: string, direction: 'up' | 'down'): Promise<ActionResult> {
  return run((db) => tree.moveLesson(db, id, direction));
}
export async function setLessonStatus(id: string, status: LessonStatus): Promise<ActionResult> {
  return run((db) => tree.setLessonStatus(db, id, status));
}
export async function deleteLesson(id: string): Promise<ActionResult> {
  return run((db) => tree.deleteLesson(db, id));
}