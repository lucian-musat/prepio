import type { SupabaseClient } from '@supabase/supabase-js';
import type { LessonStatus } from '@prepio/shared';
import { UserError, check, checkAffected, renumber, siblings as groupRows, swapInGroup, type Direction } from './db';

export { UserError };
export type { Direction };

export type TreeLesson = { id: string; node_id: string; title: string; position: number; status: LessonStatus };
export type TreeNode = {
  id: string;
  parent_id: string | null;
  title: string;
  position: number;
  children: TreeNode[];
  lessons: TreeLesson[];
};

/** Whole content tree: nodes nested by parent, each with its lessons, all ordered by position. */
export async function getTree(db: SupabaseClient): Promise<TreeNode[]> {
  const nodes = check(await db.from('nodes').select('id,parent_id,title,position').order('position'));
  const lessons = check(await db.from('lessons').select('id,node_id,title,position,status').order('position'));
  const byId = new Map<string, TreeNode>();
  for (const n of nodes as Omit<TreeNode, 'children' | 'lessons'>[]) byId.set(n.id, { ...n, children: [], lessons: [] });
  const roots: TreeNode[] = [];
  for (const n of byId.values()) (n.parent_id ? byId.get(n.parent_id)?.children ?? roots : roots).push(n);
  for (const l of lessons as TreeLesson[]) byId.get(l.node_id)?.lessons.push(l);
  return roots;
}

type Table = 'nodes' | 'lessons';
// nodes are siblings by parent_id (nullable), lessons by node_id
const GROUP_COL = { nodes: 'parent_id', lessons: 'node_id' } as const;

const siblings = (db: SupabaseClient, table: Table, groupId: string | null) => groupRows(db, table, GROUP_COL[table], groupId);

async function nextPosition(db: SupabaseClient, table: Table, groupId: string | null) {
  const rows = await siblings(db, table, groupId);
  return rows.length ? Math.max(...rows.map((r) => r.position)) + 1 : 0;
}

async function groupOf(db: SupabaseClient, table: Table, id: string): Promise<string | null> {
  const row = check(await db.from(table).select(GROUP_COL[table]).eq('id', id).single()) as unknown as Record<string, string | null>;
  return row[GROUP_COL[table]];
}

async function move(db: SupabaseClient, table: Table, id: string, direction: Direction) {
  const rows = await siblings(db, table, await groupOf(db, table, id));
  await swapInGroup(db, table, rows, id, direction);
}

async function remove(db: SupabaseClient, table: Table, id: string) {
  const group = await groupOf(db, table, id);
  checkAffected(await db.from(table).delete().eq('id', id).select('id'));
  const rows = await siblings(db, table, group);
  await renumber(db, table, rows.map((r) => r.id), rows);
}

function cleanTitle(title: string) {
  const t = title.trim();
  if (!t) throw new UserError('Titlul nu poate fi gol');
  return t;
}

export async function createNode(db: SupabaseClient, parentId: string | null, title: string): Promise<{ id: string }> {
  const position = await nextPosition(db, 'nodes', parentId);
  const row = check(
    await db.from('nodes').insert({ parent_id: parentId, title: cleanTitle(title), position }).select('id').single(),
  );
  return { id: row!.id };
}

export async function renameNode(db: SupabaseClient, id: string, title: string) {
  checkAffected(await db.from('nodes').update({ title: cleanTitle(title) }).eq('id', id).select('id'));
}

export const moveNode = (db: SupabaseClient, id: string, direction: Direction) => move(db, 'nodes', id, direction);
export const deleteNode = (db: SupabaseClient, id: string) => remove(db, 'nodes', id);

export async function createLesson(db: SupabaseClient, nodeId: string, title: string): Promise<{ id: string }> {
  const position = await nextPosition(db, 'lessons', nodeId);
  const row = check(
    await db.from('lessons').insert({ node_id: nodeId, title: cleanTitle(title), position, status: 'draft' }).select('id').single(),
  );
  return { id: row!.id };
}

export const moveLesson = (db: SupabaseClient, id: string, direction: Direction) => move(db, 'lessons', id, direction);
export const deleteLesson = (db: SupabaseClient, id: string) => remove(db, 'lessons', id);

export async function setLessonStatus(db: SupabaseClient, id: string, status: LessonStatus) {
  checkAffected(await db.from('lessons').update({ status }).eq('id', id).select('id'));
}