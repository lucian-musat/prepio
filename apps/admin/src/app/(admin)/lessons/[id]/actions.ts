'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/lib/actionResult';
import { GENERIC_ERROR, UserError, type Direction } from '@/lib/data/db';
import * as consolidation from '@/lib/data/consolidation';
import type { ExerciseInput, SourceImpact, SourceInput } from '@/lib/data/consolidation';
import * as lesson from '@/lib/data/lesson';
import { fetchLinkPreview, type LinkMetadata } from '@/lib/linkPreview';
import type { CardInput, ItemTable, QuestionInput } from '@/lib/data/lesson';
import { createServerClient } from '@/lib/supabase/server';
import { captureError } from '@/lib/sentry';

const TABLES: readonly string[] = ['cards', 'questions', 'consolidation_exercises', 'sources'];

async function run<T = void>(
  fn: (db: Awaited<ReturnType<typeof createServerClient>>) => Promise<T>,
  { revalidate = true }: { revalidate?: boolean } = {},
): Promise<ActionResult<T>> {
  try {
    const db = await createServerClient();
    const data = await fn(db);
    if (revalidate) {
      revalidatePath('/lessons/[id]', 'page');
      revalidatePath('/');
    }
    return { ok: true, data };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    console.error('[lesson action] unexpected error:', e);
    captureError(e, { route: 'lesson action' });
    return { ok: false, error: GENERIC_ERROR };
  }
}

// Arguments come from the browser: never trust them to be well-typed.
function table(t: string): ItemTable {
  if (!TABLES.includes(t)) throw new UserError(GENERIC_ERROR);
  return t as ItemTable;
}

export async function updateLesson(id: string, input: { title: string }): Promise<ActionResult> {
  return run((db) => lesson.updateLesson(db, id, input));
}
export async function saveCard(lessonId: string, card: CardInput): Promise<ActionResult<{ id: string }>> {
  return run((db) => lesson.saveCard(db, lessonId, card));
}
export async function saveQuestion(lessonId: string, q: QuestionInput): Promise<ActionResult<{ id: string }>> {
  return run((db) => lesson.saveQuestion(db, lessonId, q));
}
export async function saveSource(lessonId: string, input: SourceInput): Promise<ActionResult<{ id: string }>> {
  return run((db) => consolidation.saveSource(db, lessonId, input));
}
/** Read-only: the marked answers the new text would detach, per exercise. */
export async function previewSourceImpact(sourceId: string, body: string): Promise<ActionResult<SourceImpact>> {
  return run(async (db) => {
    if (typeof sourceId !== 'string' || typeof body !== 'string') throw new UserError(GENERIC_ERROR);
    return consolidation.sourceImpact(db, sourceId, body);
  }, { revalidate: false });
}
export async function deleteSource(id: string): Promise<ActionResult> {
  return run((db) => consolidation.deleteSource(db, id));
}
export async function saveConsolidationExercise(lessonId: string, input: ExerciseInput): Promise<ActionResult<{ id: string }>> {
  return run((db) => consolidation.saveConsolidationExercise(db, lessonId, input));
}
export async function deleteItem(t: ItemTable, id: string): Promise<ActionResult> {
  return run((db) => lesson.deleteItem(db, table(t), id));
}
export async function moveItem(t: ItemTable, id: string, direction: Direction): Promise<ActionResult> {
  return run((db) => lesson.moveItem(db, table(t), id, direction === 'up' ? 'up' : 'down'));
}
/** The file travels as FormData field `file` (server actions serialise File arguments through FormData). */
export async function uploadCardImage(lessonId: string, formData: FormData): Promise<ActionResult<{ path: string }>> {
  return run(async (db) => {
    const file = formData.get('file');
    if (!(file instanceof File)) throw new UserError('Alege o imagine.');
    return lesson.uploadCardImage(db, lessonId, file);
  });
}
/** Fetches a public page for the Link card preview. Reaches the network, so the admin check is explicit. */
export async function fetchLinkMetadata(url: string): Promise<ActionResult<LinkMetadata>> {
  return run(async (db) => {
    const { data: isAdmin, error } = await db.rpc('is_admin');
    if (error || isAdmin !== true) throw new UserError('Nu ai drepturi de administrator.');
    if (typeof url !== 'string' || !url.trim()) throw new UserError('Introdu adresa linkului.');
    return fetchLinkPreview(url);
  });
}
