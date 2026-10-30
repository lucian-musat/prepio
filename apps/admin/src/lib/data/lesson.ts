import type { SupabaseClient } from '@supabase/supabase-js';
import { validateQuestion, type DistributiveOmit, type LessonStatus, type Question } from '@prepio/shared';
import { GENERIC_ERROR, UserError, check, checkAffected, siblings, swapInGroup, renumber, type Direction } from './db';

export { UserError };

export type ItemTable = 'cards' | 'questions' | 'writing_exercises';

export type EditorCard = {
  id: string;
  position: number;
  title: string | null;
  body: string;
  image_path: string | null;
  image_credit: string | null;
};
export type EditorExercise = { id: string; position: number; prompt: string; criteria: string };
export type LessonForEdit = {
  lesson: { id: string; title: string; status: LessonStatus };
  cards: EditorCard[];
  questions: Question[];
  exercises: EditorExercise[];
};

export type CardInput = {
  id?: string;
  title?: string | null;
  body: string;
  image_path?: string | null;
  image_credit?: string | null;
};
export type QuestionInput = DistributiveOmit<Question, 'id' | 'position'> & { id?: string };
export type ExerciseInput = { id?: string; prompt: string; criteria: string };

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const blank = (s: string | null | undefined) => !s || s.trim() === '';
const orNull = (s: string | null | undefined) => (blank(s) ? null : s!.trim());

export async function getLessonForEdit(db: SupabaseClient, id: string): Promise<LessonForEdit | null> {
  const lesson = check(await db.from('lessons').select('id,title,status').eq('id', id).maybeSingle());
  if (!lesson) return null;
  const [cards, questions, exercises] = await Promise.all([
    db.from('cards').select('id,position,title,body,image_path,image_credit').eq('lesson_id', id).order('position'),
    db.from('questions').select('id,position,type,prompt,difficulty,explanation,options').eq('lesson_id', id).order('position'),
    db.from('writing_exercises').select('id,position,prompt,criteria').eq('lesson_id', id).order('position'),
  ]);
  return {
    lesson: lesson as LessonForEdit['lesson'],
    cards: check(cards) as EditorCard[],
    questions: check(questions) as Question[],
    exercises: check(exercises) as EditorExercise[],
  };
}

export async function updateLesson(db: SupabaseClient, id: string, input: { title: string }) {
  const title = input.title.trim();
  if (!title) throw new UserError('Titlul nu poate fi gol');
  checkAffected(await db.from('lessons').update({ title }).eq('id', id).select('id'));
}

async function nextPosition(db: SupabaseClient, table: ItemTable, lessonId: string) {
  const rows = await siblings(db, table, 'lesson_id', lessonId);
  return rows.length ? Math.max(...rows.map((r) => r.position)) + 1 : 0;
}

/** Inserts (no id, appended at the end) or updates (keeps position) a row of a lesson. */
async function upsert(db: SupabaseClient, table: ItemTable, lessonId: string, id: string | undefined, fields: Record<string, unknown>) {
  if (id) {
    checkAffected(await db.from(table).update(fields).eq('id', id).eq('lesson_id', lessonId).select('id'));
    return { id };
  }
  const position = await nextPosition(db, table, lessonId);
  const row = check(await db.from(table).insert({ ...fields, lesson_id: lessonId, position }).select('id').single());
  return { id: row!.id as string };
}

export async function saveCard(db: SupabaseClient, lessonId: string, card: CardInput) {
  if (blank(card.body)) throw new UserError('Textul cartonașului nu poate fi gol.');
  const fields: Record<string, unknown> = { body: card.body.trim() };
  if (card.title !== undefined) fields.title = orNull(card.title);
  if (card.image_path !== undefined) fields.image_path = card.image_path;
  if (card.image_credit !== undefined) fields.image_credit = orNull(card.image_credit);
  return upsert(db, 'cards', lessonId, card.id, fields);
}

export async function saveQuestion(db: SupabaseClient, lessonId: string, q: QuestionInput) {
  const options = q.options.map((o) => ({ ...o, text: o.text.trim() }));
  const candidate = { ...q, options, id: q.id ?? 'new', position: 0 } as Question;
  const errors = validateQuestion(candidate);
  if (options.some((o) => !o.text)) errors.push('Textul variantei nu poate fi gol.');
  if (errors.length) throw new UserError(errors.join(' '));
  return upsert(db, 'questions', lessonId, q.id, {
    type: q.type,
    prompt: q.prompt.trim(),
    difficulty: q.difficulty,
    explanation: orNull(q.explanation),
    options: options.map((o) => ('label' in o && blank(o.label) ? { id: o.id, text: o.text } : o)),
  });
}

export async function saveExercise(db: SupabaseClient, lessonId: string, e: ExerciseInput) {
  if (blank(e.prompt)) throw new UserError('Enunțul exercițiului nu poate fi gol.');
  if (blank(e.criteria)) throw new UserError('Criteriile nu pot fi goale.');
  return upsert(db, 'writing_exercises', lessonId, e.id, { prompt: e.prompt.trim(), criteria: e.criteria.trim() });
}

async function lessonOf(db: SupabaseClient, table: ItemTable, id: string): Promise<string> {
  const row = check(await db.from(table).select('lesson_id').eq('id', id).single()) as unknown as { lesson_id: string };
  return row.lesson_id;
}

export async function deleteItem(db: SupabaseClient, table: ItemTable, id: string) {
  const lessonId = await lessonOf(db, table, id);
  checkAffected(await db.from(table).delete().eq('id', id).select('id'));
  const rows = await siblings(db, table, 'lesson_id', lessonId);
  await renumber(db, table, rows.map((r) => r.id), rows);
}

export async function moveItem(db: SupabaseClient, table: ItemTable, id: string, direction: Direction) {
  const rows = await siblings(db, table, 'lesson_id', await lessonOf(db, table, id));
  await swapInGroup(db, table, rows, id, direction);
}

/** Uploads to `images/lessons/<lessonId>/<uuid>.<ext>`; returns the storage path (not a URL). */
export async function uploadCardImage(db: SupabaseClient, lessonId: string, file: File): Promise<{ path: string }> {
  const ext = IMAGE_EXT[file.type];
  if (!ext) throw new UserError('Sunt acceptate doar imagini JPEG, PNG sau WebP.');
  if (file.size > MAX_IMAGE_BYTES) throw new UserError('Imaginea depășește 5 MB.');
  const path = `lessons/${lessonId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await db.storage.from('images').upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    console.error('[lesson] upload error:', error);
    throw new UserError(GENERIC_ERROR);
  }
  return { path };
}
