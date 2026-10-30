'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/lib/actionResult';
import { GENERIC_ERROR, UserError, type Direction } from '@/lib/data/db';
import * as lesson from '@/lib/data/lesson';
import type { CardInput, ExerciseInput, ItemTable, QuestionInput } from '@/lib/data/lesson';
import { createServerClient } from '@/lib/supabase/server';

const TABLES: readonly string[] = ['cards', 'questions', 'writing_exercises'];

async function run<T = void>(fn: (db: Awaited<ReturnType<typeof createServerClient>>) => Promise<T>): Promise<ActionResult<T>> {
  try {
    const db = await createServerClient();
    const data = await fn(db);
    revalidatePath('/lessons/[id]', 'page');
    revalidatePath('/');
    return { ok: true, data };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    console.error('[lesson action] unexpected error:', e);
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
export async function saveExercise(lessonId: string, e: ExerciseInput): Promise<ActionResult<{ id: string }>> {
  return run((db) => lesson.saveExercise(db, lessonId, e));
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
