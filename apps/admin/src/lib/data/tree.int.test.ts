import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createLesson, createNode, deleteLesson, deleteNode, getTree, moveLesson, moveNode, renameNode, setLessonStatus,
} from './tree';

config({ path: [resolve(__dirname, '../../../.env.local'), resolve(__dirname, '../../../../../.env')], quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const email = process.env.ADMIN_EMAIL ?? 'admin@prepio.local';
const password = process.env.ADMIN_PASSWORD ?? 'prepio-local-admin';

describe.skipIf(!url || !anon)('tree data functions (local Supabase)', () => {
  let db: SupabaseClient;
  let rootId: string;

  async function childTitles(parentId: string) {
    const { data } = await db.from('nodes').select('title,position').eq('parent_id', parentId).order('position');
    return data!;
  }

  beforeAll(async () => {
    db = createClient(url!, anon!, { auth: { persistSession: false } });
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    rootId = (await createNode(db, null, '[test] root')).id;
  });

  afterAll(async () => {
    if (rootId) await db.from('nodes').delete().eq('id', rootId);
  });

  it('creates and renames nodes with contiguous positions', async () => {
    const a = await createNode(db, rootId, 'A');
    const b = await createNode(db, rootId, 'B');
    expect((await childTitles(rootId)).map((n) => [n.title, n.position])).toEqual([['A', 0], ['B', 1]]);
    await renameNode(db, a.id, 'A2');
    expect((await childTitles(rootId))[0].title).toBe('A2');
    await deleteNode(db, a.id);
    await deleteNode(db, b.id);
  });

  it('moves nodes by swapping; up at top and down at bottom are no-ops', async () => {
    const a = await createNode(db, rootId, 'M1');
    const b = await createNode(db, rootId, 'M2');
    await moveNode(db, a.id, 'up');
    await moveNode(db, b.id, 'down');
    expect((await childTitles(rootId)).map((n) => n.title)).toEqual(['M1', 'M2']);
    await moveNode(db, a.id, 'down');
    expect((await childTitles(rootId)).map((n) => n.title)).toEqual(['M2', 'M1']);
    await moveNode(db, a.id, 'up');
    expect((await childTitles(rootId)).map((n) => n.title)).toEqual(['M1', 'M2']);
    await deleteNode(db, a.id);
    await deleteNode(db, b.id);
  });

  it('deleting a node renumbers siblings and cascades to children and lessons', async () => {
    const a = await createNode(db, rootId, 'D1');
    const b = await createNode(db, rootId, 'D2');
    const c = await createNode(db, rootId, 'D3');
    const sub = await createNode(db, b.id, 'D2-sub');
    const l = await createLesson(db, b.id, 'D2-lesson');
    await deleteNode(db, b.id);
    expect((await childTitles(rootId)).map((n) => [n.title, n.position])).toEqual([['D1', 0], ['D3', 1]]);
    expect((await db.from('nodes').select('id').eq('id', sub.id)).data).toEqual([]);
    expect((await db.from('lessons').select('id').eq('id', l.id)).data).toEqual([]);
    await deleteNode(db, a.id);
    await deleteNode(db, c.id);
  });

  it('creates lessons as drafts, toggles status, moves and deletes with renumbering', async () => {
    const n = await createNode(db, rootId, 'L-node');
    const l1 = await createLesson(db, n.id, 'L1');
    const l2 = await createLesson(db, n.id, 'L2');
    const l3 = await createLesson(db, n.id, 'L3');
    const lessons = async () =>
      (await db.from('lessons').select('title,position,status').eq('node_id', n.id).order('position')).data!;
    expect(await lessons()).toEqual([
      { title: 'L1', position: 0, status: 'draft' },
      { title: 'L2', position: 1, status: 'draft' },
      { title: 'L3', position: 2, status: 'draft' },
    ]);
    await setLessonStatus(db, l1.id, 'published');
    expect((await lessons())[0].status).toBe('published');
    await setLessonStatus(db, l1.id, 'draft');
    expect((await lessons())[0].status).toBe('draft');
    await moveLesson(db, l1.id, 'up');
    expect((await lessons()).map((x) => x.title)).toEqual(['L1', 'L2', 'L3']);
    await moveLesson(db, l1.id, 'down');
    expect((await lessons()).map((x) => x.title)).toEqual(['L2', 'L1', 'L3']);
    await deleteLesson(db, l2.id);
    expect((await lessons()).map((x) => [x.title, x.position])).toEqual([['L1', 0], ['L3', 1]]);
    await deleteLesson(db, l3.id);
    await deleteNode(db, n.id);
  });

  it('getTree returns nested nodes with their lessons in order', async () => {
    const n = await createNode(db, rootId, 'T1');
    await createNode(db, n.id, 'T1-child');
    await createLesson(db, n.id, 'T1-lesson');
    const tree = await getTree(db);
    const root = tree.find((x) => x.id === rootId)!;
    const t1 = root.children.find((x) => x.id === n.id)!;
    expect(t1.children.map((x) => x.title)).toEqual(['T1-child']);
    expect(t1.lessons.map((x) => x.title)).toEqual(['T1-lesson']);
    expect(tree.length).toBeGreaterThan(1); // seeded content is present too
    await deleteNode(db, n.id);
  });
});
