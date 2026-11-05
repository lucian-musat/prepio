import type { SupabaseClient } from '@supabase/supabase-js';
import type { LessonSummary, TreeNode } from '@prepio/shared';
import { fetchHome, fetchLesson, groupLessonsByTree, imageUrl } from './content';

const nodes: TreeNode[] = [
  { id: 'c', parentId: null, title: 'C. Statul și politica', position: 2 },
  { id: 'a', parentId: null, title: 'A. Evul Mediu', position: 1 },
  { id: 'c2', parentId: 'c', title: 'Formarea statului', position: 2 },
  { id: 'c1', parentId: 'c', title: 'Instituții', position: 1 },
  { id: 'empty', parentId: 'a', title: 'Fără lecții', position: 1 },
];
const lessons: LessonSummary[] = [
  { id: 'l3', nodeId: 'c2', title: 'Lecția 3', position: 1 },
  { id: 'l2', nodeId: 'c1', title: 'Lecția 2', position: 2 },
  { id: 'l1', nodeId: 'c1', title: 'Lecția 1', position: 1 },
  { id: 'l0', nodeId: 'a', title: 'Lecția 0', position: 1 },
];

describe('groupLessonsByTree', () => {
  it('groups lessons under their node with a root-to-node path', () => {
    const sections = groupLessonsByTree(nodes, lessons);
    const c2 = sections.find((s) => s.lessons[0]?.id === 'l3');
    expect(c2?.path).toEqual(['C. Statul și politica', 'Formarea statului']);
  });

  it('orders sections by tree position and lessons by position, omitting empty nodes', () => {
    const sections = groupLessonsByTree(nodes, lessons);
    expect(sections.map((s) => s.path)).toEqual([
      ['A. Evul Mediu'],
      ['C. Statul și politica', 'Instituții'],
      ['C. Statul și politica', 'Formarea statului'],
    ]);
    expect(sections[1]?.lessons.map((l) => l.id)).toEqual(['l1', 'l2']);
  });
});

/** Minimal chainable, awaitable stand-in for a PostgREST query builder. */
function mockClient(results: Record<string, { data: unknown; error: unknown }>) {
  const calls: string[] = [];
  const from = (table: string) => {
    calls.push(table);
    const result = results[table] ?? { data: null, error: null };
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'order']) chain[m] = () => chain;
    chain.maybeSingle = () => Promise.resolve(result);
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
      Promise.resolve(result).then(res, rej);
    return chain;
  };
  return { client: { from } as unknown as SupabaseClient, calls };
}

describe('fetchLesson', () => {
  it('maps snake_case rows to shared camelCase types, sorted by position', async () => {
    const { client } = mockClient({
      lessons: {
        error: null,
        data: {
          id: 'l1',
          node_id: 'n1',
          title: 'Lecția',
          position: 3,
          status: 'published',
          cards: [
            { id: 'k2', position: 2, title: null, type: 'text', content: { text: 'b2' } },
            {
              id: 'k1',
              position: 1,
              title: 'T',
              type: 'images',
              content: { images: [{ path: 'x.jpg', alt: 'a', credit: 'Wiki' }], display: 'single', text: 'b1' },
            },
          ],
          questions: [
            { id: 'q2', position: 2, type: 'single_choice', prompt: 'p2', difficulty: 'easy', explanation: null, options: [] },
            { id: 'q1', position: 1, type: 'chronological_order', prompt: 'p1', difficulty: 'hard', explanation: 'e', options: [{ id: 'o', text: 't' }] },
          ],
        },
      },
    });
    const lesson = await fetchLesson('l1', client);
    expect(lesson).toMatchObject({ id: 'l1', nodeId: 'n1', status: 'published', position: 3 });
    expect(lesson?.cards.map((c) => c.id)).toEqual(['k1', 'k2']);
    expect(lesson?.cards[0]).toEqual({
      id: 'k1',
      position: 1,
      title: 'T',
      type: 'images',
      images: [{ path: 'x.jpg', alt: 'a', credit: 'Wiki' }],
      display: 'single',
      text: 'b1',
    });
    expect(lesson?.cards[1]).toEqual({ id: 'k2', position: 2, title: null, type: 'text', text: 'b2' });
    expect(lesson?.questions.map((q) => q.id)).toEqual(['q1', 'q2']);
  });

  it('returns null when the lesson is not visible', async () => {
    const { client } = mockClient({ lessons: { data: null, error: null } });
    expect(await fetchLesson('nope', client)).toBeNull();
  });

  it('throws on a query error', async () => {
    const { client } = mockClient({ lessons: { data: null, error: new Error('boom') } });
    await expect(fetchLesson('x', client)).rejects.toThrow('boom');
  });
});

describe('fetchHome', () => {
  it('combines welcome message and grouped lessons', async () => {
    const { client } = mockClient({
      nodes: { error: null, data: [{ id: 'a', parent_id: null, title: 'A', position: 1 }] },
      lessons: { error: null, data: [{ id: 'l', node_id: 'a', title: 'L', position: 1 }] },
      settings: { error: null, data: { welcome_message: 'Bun venit!' } },
    });
    const home = await fetchHome(client);
    expect(home.welcomeMessage).toBe('Bun venit!');
    expect(home.sections).toEqual([
      { path: ['A'], lessons: [{ id: 'l', nodeId: 'a', title: 'L', position: 1 }] },
    ]);
  });
});

describe('imageUrl', () => {
  it('builds a public storage URL', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
    expect(imageUrl('a/b.jpg')).toBe('http://127.0.0.1:54321/storage/v1/object/public/images/a/b.jpg');
  });
});