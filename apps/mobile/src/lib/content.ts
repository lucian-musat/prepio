import type { SupabaseClient } from '@supabase/supabase-js';
import { cardFromRow, type Card, type Lesson, LessonSummary, Question, TreeNode } from '@prepio/shared';
import { getSupabase } from './supabase';

export type HomeData = {
  welcomeMessage: string;
  sections: Array<{ path: string[]; lessons: LessonSummary[] }>;
};

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

/**
 * Groups lessons under their tree node. Sections follow depth-first tree order
 * (siblings by position); `path` is the titles from the root to the node.
 * Nodes without lessons are omitted.
 */
export function groupLessonsByTree(nodes: TreeNode[], lessons: LessonSummary[]): HomeData['sections'] {
  const children = new Map<string | null, TreeNode[]>();
  for (const n of nodes) {
    const list = children.get(n.parentId) ?? [];
    list.push(n);
    children.set(n.parentId, list);
  }
  const byNode = new Map<string, LessonSummary[]>();
  for (const l of lessons) {
    const list = byNode.get(l.nodeId) ?? [];
    list.push(l);
    byNode.set(l.nodeId, list);
  }

  const sections: HomeData['sections'] = [];
  const walk = (parentId: string | null, path: string[]) => {
    for (const node of [...(children.get(parentId) ?? [])].sort(byPosition)) {
      const nodePath = [...path, node.title];
      const own = byNode.get(node.id);
      if (own?.length) sections.push({ path: nodePath, lessons: [...own].sort(byPosition) });
      walk(node.id, nodePath);
    }
  };
  walk(null, []);
  return sections;
}

export function imageUrl(path: string): string {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  return `${base}/storage/v1/object/public/images/${path}`;
}

export async function fetchHome(client: SupabaseClient = getSupabase()): Promise<HomeData> {
  const [nodesRes, lessonsRes, settingsRes] = await Promise.all([
    client.from('nodes').select('id,parent_id,title,position').order('position'),
    client
      .from('lessons')
      .select('id,node_id,title,position')
      .eq('status', 'published')
      .order('position'),
    client.from('settings').select('welcome_message').eq('id', 1).maybeSingle(),
  ]);
  for (const res of [nodesRes, lessonsRes, settingsRes]) if (res.error) throw res.error;

  const nodes: TreeNode[] = (nodesRes.data ?? []).map((r) => ({
    id: r.id,
    parentId: r.parent_id,
    title: r.title,
    position: r.position,
  }));
  const lessons: LessonSummary[] = (lessonsRes.data ?? []).map((r) => ({
    id: r.id,
    nodeId: r.node_id,
    title: r.title,
    position: r.position,
  }));
  return {
    welcomeMessage: settingsRes.data?.welcome_message ?? '',
    sections: groupLessonsByTree(nodes, lessons),
  };
}

export async function fetchLesson(
  id: string,
  client: SupabaseClient = getSupabase(),
): Promise<Lesson | null> {
  const { data, error } = await client
    .from('lessons')
    .select('*, cards(*), questions(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const cards: Card[] = (data.cards ?? []).map((c: any) => cardFromRow(c));
  const questions: Question[] = (data.questions ?? []).map((q: any) => ({
    id: q.id,
    position: q.position,
    type: q.type,
    prompt: q.prompt,
    difficulty: q.difficulty,
    explanation: q.explanation,
    options: q.options,
  }));
  return {
    id: data.id,
    nodeId: data.node_id,
    title: data.title,
    position: data.position,
    status: data.status,
    cards: cards.sort(byPosition),
    questions: questions.sort(byPosition),
  };
}