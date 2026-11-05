import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cardImagePaths, cardToRow } from '@prepio/shared';
import { BUCKET, IMAGES_DIR, check, contentType, seedPath, withStoragePaths } from './seed';
import type { SeedCard, SeedQuestion } from './types';

/**
 * Demo lesson for testing the app by hand (pre-launch only): one card of every type and a few single-choice
 * questions whose first option is always the right one. When a feature is added to lessons, add it here too.
 * It lives in its own root node, placed before every other node, so it is the first lesson (open in guided mode).
 */
export const DEMO_NODE_TITLE = 'Demo';
export const DEMO_LESSON_TITLE = '[demo] Toate funcționalitățile';

export const DEMO_CARDS: SeedCard[] = [
  {
    type: 'text',
    title: 'Card text',
    text:
      '### Titlu în text\n\n' +
      'Text cu **bold**, *italic* și o listă:\n\n' +
      '- primul punct\n- al doilea punct\n\n' +
      '1. pas unu\n2. pas doi\n\n' +
      ':::retine\nCasetă „De reținut”.\n:::\n\n' +
      ':::atentie\nCasetă „Atenție”.\n:::\n\n' +
      ':::exemplu\nCasetă „Exemplu”.\n:::',
  },
  {
    type: 'images',
    title: 'Card imagini (o imagine)',
    display: 'single',
    images: [{ path: 'cuza.jpg', alt: 'Alexandru Ioan Cuza', credit: 'Sursa: Wikimedia Commons, domeniu public' }],
    text: 'O singură imagine; apasă pe ea ca să o mărești.',
  },
  {
    type: 'images',
    title: 'Card imagini (galerie)',
    display: 'gallery',
    images: [
      { path: 'carol-i.jpg', alt: 'Carol I', credit: 'Sursa: Wikimedia Commons, domeniu public' },
      { path: 'kogalniceanu.jpg', alt: 'Mihail Kogălniceanu', credit: 'Sursa: Wikimedia Commons, domeniu public' },
      { path: 'ion-c-bratianu.jpg', alt: 'Ion C. Brătianu', credit: 'Sursa: Wikimedia Commons, domeniu public' },
    ],
    text: 'Galerie: o imagine mare și miniaturi dedesubt.',
  },
  {
    type: 'video',
    title: 'Card video',
    youtubeId: 'Ip7Pxren00U',
    startSeconds: 10,
    endSeconds: 70,
    text: 'Video YouTube cu început și sfârșit setate (secundele 10–70).',
  },
  {
    type: 'timeline',
    title: 'Card cronologie',
    points: [
      { id: 'p1', date: '1859', title: 'Punct cu imagine', details: 'Detalii pentru primul punct.', key: true, imagePath: 'hora-unirii-aman.jpg' },
      { id: 'p2', date: '1866', title: 'Punct simplu', details: null, key: false, imagePath: null },
      { id: 'p3', date: '1877', title: 'Punct-cheie', details: 'Un punct marcat ca important.', key: true, imagePath: null },
    ],
  },
  {
    type: 'schema',
    title: 'Card schemă',
    causesLabel: 'Cauze',
    consequencesLabel: 'Urmări',
    causes: [
      { id: 'c1', text: 'Cauza unu', detail: 'Detaliu pentru cauza unu.' },
      { id: 'c2', text: 'Cauza doi', detail: null },
    ],
    central: { id: 'center', text: 'Evenimentul central', detail: 'Detaliu pentru eveniment.' },
    consequences: [
      { id: 'u1', text: 'Urmarea unu', detail: null },
      { id: 'u2', text: 'Urmarea doi', detail: 'Detaliu pentru urmarea doi.' },
    ],
  },
  {
    type: 'link',
    title: 'Card link',
    url: 'https://ro.wikipedia.org/wiki/Unirea_Principatelor_Rom%C3%A2ne',
    pageTitle: 'Unirea Principatelor Române',
    description: 'Link extern cu imagine, titlu și descriere.',
    image: { kind: 'path', path: 'harta-romania-1859-1878.jpg' },
    text: 'Text sub link.',
  },
];

const demoQuestion = (n: number): SeedQuestion => ({
  type: 'single_choice',
  difficulty: 'easy',
  prompt: `Întrebarea demo ${n}: primul răspuns e mereu cel corect.`,
  options: [
    { id: 'a', text: 'Răspuns corect', correct: true },
    { id: 'b', text: 'Răspuns greșit', correct: false },
    { id: 'c', text: 'Alt răspuns greșit', correct: false },
  ],
  explanation: 'Explicația apare după verificare.',
});

/** Single choice only, no AI writing exercises. */
export const DEMO_QUESTIONS: SeedQuestion[] = [1, 2, 3].map(demoQuestion);

export type DemoResult = { applied: boolean; action: 'create' | 'update' | 'remove' | 'nothing'; cards: number; questions: number };

type NodeRow = { id: string; parent_id: string | null; title: string; position: number };

async function demoNode(client: SupabaseClient): Promise<{ node: NodeRow | null; firstPosition: number }> {
  const roots = check(
    await client.from('nodes').select('id, parent_id, title, position').is('parent_id', null),
    'list root nodes',
  ) as NodeRow[];
  const node = roots.find((r) => r.title === DEMO_NODE_TITLE) ?? null;
  const others = roots.filter((r) => r !== node).map((r) => r.position);
  return { node, firstPosition: others.length ? Math.min(...others) : 0 };
}

/**
 * Creates or refreshes the demo lesson: its node is moved before every other root node, its cards and questions
 * are replaced by the ones above, and every student's progress in it is cleared (so it starts fresh). With
 * `remove`, deletes the demo node (and the lesson, by cascade) instead. Without `apply`, only plans.
 */
export async function seedDemo(client: SupabaseClient, opts: { apply: boolean; remove?: boolean }): Promise<DemoResult> {
  const { node, firstPosition } = await demoNode(client);
  const counts = { cards: DEMO_CARDS.length, questions: DEMO_QUESTIONS.length };

  if (opts.remove) {
    if (!node) return { applied: opts.apply, action: 'nothing', cards: 0, questions: 0 };
    if (opts.apply) check(await client.from('nodes').delete().eq('id', node.id).select('id'), 'delete demo node');
    return { applied: opts.apply, action: 'remove', cards: 0, questions: 0 };
  }

  const lessons = node
    ? (check(await client.from('lessons').select('id').eq('node_id', node.id).eq('title', DEMO_LESSON_TITLE), 'find demo lesson') as {
        id: string;
      }[])
    : [];
  const result: DemoResult = { applied: opts.apply, action: lessons.length ? 'update' : 'create', ...counts };
  if (!opts.apply) return result;

  for (const file of new Set(DEMO_CARDS.flatMap((c) => cardImagePaths(c)))) {
    const body = await readFile(resolve(IMAGES_DIR, file));
    const { error } = await client.storage.from(BUCKET).upload(seedPath(file), body, { upsert: true, contentType: contentType(file) });
    if (error) throw new Error(`upload ${file}: ${error.message}`);
  }

  // Before every other root node, so the demo is the first lesson.
  const position = firstPosition - 1;
  const nodeId = node
    ? (check(await client.from('nodes').update({ position }).eq('id', node.id).select('id').single(), 'move demo node') as { id: string }).id
    : (check(await client.from('nodes').insert({ title: DEMO_NODE_TITLE, parent_id: null, position }).select('id').single(), 'create demo node') as {
        id: string;
      }).id;

  let lessonId = lessons[0]?.id;
  if (lessonId) {
    for (const table of ['cards', 'questions', 'consolidation_exercises', 'lesson_progress'] as const) {
      check(await client.from(table).delete().eq('lesson_id', lessonId), `clear demo ${table}`);
    }
  } else {
    lessonId = (
      check(
        await client.from('lessons').insert({ node_id: nodeId, title: DEMO_LESSON_TITLE, position: 0, status: 'published' }).select('id').single(),
        'create demo lesson',
      ) as { id: string }
    ).id;
  }

  check(
    await client.from('cards').insert(DEMO_CARDS.map((c, i) => ({ lesson_id: lessonId, position: i, ...cardToRow(withStoragePaths(c)) }))),
    'insert demo cards',
  );
  check(
    await client.from('questions').insert(
      DEMO_QUESTIONS.map((q, i) => ({
        lesson_id: lessonId,
        position: i,
        type: q.type,
        prompt: q.prompt,
        difficulty: q.difficulty,
        explanation: q.explanation,
        options: q.options,
      })),
    ),
    'insert demo questions',
  );
  return result;
}

export function formatDemo(r: DemoResult): string {
  const what =
    r.action === 'nothing'
      ? 'no demo lesson found (nothing to do)'
      : r.action === 'remove'
        ? `${r.applied ? 'removed' : 'to remove'}: node „${DEMO_NODE_TITLE}” with lesson „${DEMO_LESSON_TITLE}”`
        : `${r.applied ? (r.action === 'create' ? 'created' : 'refreshed') : `to ${r.action === 'create' ? 'create' : 'refresh'}`}: ` +
          `„${DEMO_LESSON_TITLE}” with ${r.cards} card(s) and ${r.questions} question(s)` +
          (r.action === 'update' ? '; progress in it reset' : '');
  return `${r.applied ? '' : 'Dry run (nothing is changed; pass --apply to write)\n'}Demo lesson ${what}.`;
}

async function main(): Promise<void> {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  // Local runs read the repo .env files; values already in the environment (the cloud wrapper) take precedence.
  config({ path: [resolve(root, '.env.local'), resolve(root, '.env')], quiet: true });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.example)');
  const args = process.argv.slice(2);
  const unknown = args.filter((a) => a !== '--apply' && a !== '--remove');
  if (unknown.length) throw new Error(`Unknown argument(s): ${unknown.join(' ')} (only --apply and --remove are supported)`);

  console.log(`Target: ${new URL(url).host}`);
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  console.log(formatDemo(await seedDemo(client, { apply: args.includes('--apply'), remove: args.includes('--remove') })));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
