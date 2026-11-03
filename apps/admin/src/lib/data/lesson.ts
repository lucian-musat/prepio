import type { SupabaseClient } from '@supabase/supabase-js';
import {
  cardFromRow, cardImagePaths, cardToRow, validateCard, validateQuestion,
  type Card, type CardRow, type DistributiveOmit, type LessonStatus, type Question,
} from '@prepio/shared';
import { GENERIC_ERROR, UserError, check, isUuid, checkAffected, siblings, swapInGroup, renumber, type Direction } from './db';

export { UserError };

export type ItemTable = 'cards' | 'questions' | 'writing_exercises';

export type EditorCard = Card;
export type EditorExercise = { id: string; position: number; prompt: string; criteria: string };
export type LessonForEdit = {
  lesson: { id: string; title: string; status: LessonStatus };
  cards: Card[];
  questions: Question[];
  exercises: EditorExercise[];
};

export type CardInput = DistributiveOmit<Card, 'id' | 'position'> & { id?: string };
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
    db.from('cards').select('id,position,title,type,content').eq('lesson_id', id).order('position'),
    db.from('questions').select('id,position,type,prompt,difficulty,explanation,options').eq('lesson_id', id).order('position'),
    db.from('writing_exercises').select('id,position,prompt,criteria').eq('lesson_id', id).order('position'),
  ]);
  return {
    lesson: lesson as LessonForEdit['lesson'],
    cards: (check(cards) as unknown as CardRow[]).map(cardFromRow),
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

// Optional text fields that an empty string turns into null (everything else only gets trimmed).
const NULLABLE_KEYS = new Set(['detail', 'details', 'description', 'credit', 'imagePath']);

function trimDeep(v: unknown, key?: string, type?: string): unknown {
  if (typeof v === 'string') {
    const t = v.trim();
    const nullable = NULLABLE_KEYS.has(key ?? '') || (key === 'text' && type !== 'text');
    return t === '' && nullable ? null : t;
  }
  if (Array.isArray(v)) return v.map((x) => trimDeep(x, key, type));
  if (typeof v === 'object' && v !== null) {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, trimDeep(x, k, type)]));
  }
  return v;
}

const ownsPath = (lessonId: string, p: string) => p.startsWith(`lessons/${lessonId}/`) || p.startsWith('seed/');

/** Removes uploaded (`lessons/`) objects; `seed/` assets are never touched. Failures are logged, not thrown. */
async function removeImages(db: SupabaseClient, paths: string[]) {
  const doomed = paths.filter((p) => p.startsWith('lessons/'));
  if (!doomed.length) return;
  try {
    const { error } = await db.storage.from('images').remove(doomed);
    if (error) console.error('[lesson] image cleanup error:', error);
  } catch (e) {
    console.error('[lesson] image cleanup error:', e);
  }
}

async function storedCard(db: SupabaseClient, id: string): Promise<Card | null> {
  const row = check(await db.from('cards').select('id,position,title,type,content').eq('id', id).maybeSingle());
  return row ? cardFromRow(row as unknown as CardRow) : null;
}

export async function saveCard(db: SupabaseClient, lessonId: string, input: CardInput) {
  // Rebuild from the shared model: coerces types and drops unknown keys; then trim.
  const raw = cardFromRow({
    id: input.id ?? 'new', position: 0, title: input.title ?? null, type: input.type, content: input,
  } as unknown as CardRow);
  const { id: _id, position: _position, ...rest } = raw;
  const card = trimDeep(rest, undefined, raw.type) as DistributiveOmit<Card, 'id' | 'position'>;
  card.title = orNull(card.title);
  const paths = cardImagePaths(card);
  if (paths.some((p) => !ownsPath(lessonId, p))) throw new UserError('Imagine invalidă.');
  const errors = validateCard(card);
  if (errors.length) throw new UserError(errors.join(' '));

  const old = input.id ? await storedCard(db, input.id) : null;
  const saved = await upsert(db, 'cards', lessonId, input.id, cardToRow(card));
  if (old) {
    const kept = new Set(paths);
    await removeImages(db, cardImagePaths(old).filter((p) => !kept.has(p)));
  }
  return saved;
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
  const old = table === 'cards' ? await storedCard(db, id) : null;
  checkAffected(await db.from(table).delete().eq('id', id).select('id'));
  if (old) await removeImages(db, cardImagePaths(old));
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
  // lessonId comes from the browser: it must be a real lesson before it may shape a storage path.
  if (!isUuid(lessonId)) throw new UserError('Lecția nu există.');
  const exists = check(await db.from('lessons').select('id').eq('id', lessonId).maybeSingle());
  if (!exists) throw new UserError('Lecția nu există.');
  const path = `lessons/${lessonId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await db.storage.from('images').upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    console.error('[lesson] upload error:', error);
    throw new UserError(GENERIC_ERROR);
  }
  return { path };
}
