import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cardImagePaths, cardToRow } from '@prepio/shared';
import { ensureTemplates, writeConsolidation } from './consolidation';
import { BUCKET, IMAGES_DIR, check, contentType, seedPath, withStoragePaths } from './seed';
import type { SeedCard, SeedConsolidation, SeedQuestion, SeedSource } from './types';

/**
 * Demo lesson for testing the app by hand (pre-launch only): one card of every type, a few single-choice
 * questions whose first option is always the right one and one consolidation exercise of every type, in the BAC order
 * (with the solution templates they use, added when missing). When a feature is added to lessons, add it here too.
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

/** Single choice only. */
export const DEMO_QUESTIONS: SeedQuestion[] = [1, 2, 3].map(demoQuestion);

export const DEMO_SOURCES: SeedSource[] = [
  {
    key: 'demo',
    title: 'Sursă demo',
    author: 'Manual de istorie',
    work: 'clasa a XII-a',
    body:
      'Adunările ad-hoc s-au întrunit în 1857. Ele au cerut unirea Principatelor într-un stat numit România. ' +
      'Deoarece Convenția de la Paris nu interzicea alegerea aceleiași persoane în ambele Principate, Alexandru Ioan ' +
      'Cuza a fost ales domn la Iași și la București, în ianuarie 1859.',
  },
  {
    key: 'reforme',
    title: 'Reformele lui Cuza',
    author: 'Sinteză de istorie a românilor',
    work: 'epoca modernă',
    body:
      'În timpul domniei lui Alexandru Ioan Cuza au fost adoptate reforme importante. Prin secularizarea din 1863, ' +
      'averile mănăstirești au trecut în proprietatea statului. Legea rurală din 1864 a desființat claca, iar ' +
      'țăranii au fost împroprietăriți. Legea instrucțiunii publice din 1864 a făcut învățământul primar obligatoriu ' +
      'și gratuit.',
  },
];

const demo = (quote: string) => ({ source: 'demo', quote });
const reforme = (quote: string) => ({ source: 'reforme', quote });

/** One exercise of every type, in the BAC order: five checked without AI, five AI types (one a two-requirement essay). */
export const DEMO_CONSOLIDATION: SeedConsolidation[] = [
  {
    type: 'short_answer',
    prompt: 'Numiți domnul ales în ambele Principate, precizat în sursa dată.',
    template: 'short_answer',
    sources: ['demo'],
    accepted: ['Alexandru Ioan Cuza', 'Cuza', 'Alexandru Cuza'],
    mistakes: [{ answer: 'Carol', message: 'Carol a venit abia în 1866. Caută în sursă cine a fost ales în 1859.' }],
    explanation: 'Răspunsul este în ultima propoziție a sursei.',
  },
  {
    type: 'multi_answer',
    prompt: 'Menționați cele două orașe în care a fost ales domn Alexandru Ioan Cuza, precizate în sursa dată.',
    template: 'multi_answer',
    sources: ['demo'],
    count: 2,
    groups: [['Iași'], ['București']],
    explanation: 'Sursa spune că Cuza a fost ales domn „la Iași și la București”.',
  },
  {
    type: 'source_info',
    prompt: 'Precizați, din sursa dată, o informație referitoare la Adunările ad-hoc.',
    template: 'source_info',
    sources: ['demo'],
    count: 1,
    spans: [demo('Adunările ad-hoc s-au întrunit în 1857'), demo('au cerut unirea Principatelor într-un stat numit România')],
    explanation: 'Primele două propoziții ale sursei sunt despre Adunările ad-hoc.',
  },
  {
    type: 'source_letter',
    prompt: 'Scrieți litera corespunzătoare sursei care susține că învățământul primar a devenit obligatoriu.',
    template: 'source_letter',
    sources: ['demo', 'reforme'],
    correct: 'B',
    evidence: reforme('a făcut învățământul primar obligatoriu și gratuit'),
    explanation: 'Sursa A vorbește despre Unire; legea instrucțiunii publice apare în sursa B.',
  },
  {
    type: 'cause_effect',
    prompt: 'Scrieți o relație cauză-efect stabilită între două informații selectate din sursa dată, precizând rolul fiecăreia.',
    template: 'cause_effect',
    sources: ['demo'],
    pairs: [
      {
        cause: demo('Convenția de la Paris nu interzicea alegerea aceleiași persoane în ambele Principate'),
        effect: demo('Alexandru Ioan Cuza a fost ales domn la Iași și la București'),
        explanation: 'Conectorul „Deoarece” introduce cauza.',
      },
    ],
  },
  {
    type: 'facts',
    prompt: 'Prezentați două fapte istorice referitoare la domnia lui Alexandru Ioan Cuza (1859–1866).',
    template: 'facts',
    sources: [],
    count: 2,
    modelAnswer:
      '1. În ianuarie 1862 s-au format un guvern unic și o adunare unică, iar capitala a devenit București. Astfel, ' +
      'unirea Principatelor a devenit deplină.\n' +
      '2. Legea rurală din august 1864, promovată de Mihail Kogălniceanu, a desființat claca și dijma și i-a ' +
      'împroprietărit pe clăcași, în schimbul unei despăgubiri.',
    ai: {
      main:
        'Perioada: domnia lui Alexandru Ioan Cuza (1859–1866). Fapte acceptate: dubla alegere (ianuarie 1859), ' +
        'unificarea instituțiilor (guvern și adunare unică, capitala la București, 1862), secularizarea averilor ' +
        'mănăstirești (1863), lovitura de stat și Statutul Dezvoltător (1864), legea rurală (1864), legea ' +
        'instrucțiunii publice (1864), abdicarea (februarie 1866). Faptele trebuie prezentate, nu doar menționate, și ' +
        'să fie diferite. Greșeli frecvente: Constituția din 1866 (după abdicare), independența (1877).',
      requirements: {},
    },
  },
  {
    type: 'comparison',
    prompt: 'Menționați o asemănare între secularizarea averilor mănăstirești (1863) și legea rurală (1864).',
    template: 'comparison',
    sources: [],
    variant: 'similarity',
    modelAnswer:
      'Atât secularizarea averilor mănăstirești, cât și legea rurală au fost adoptate în timpul domniei lui Alexandru ' +
      'Ioan Cuza, de guvernul condus de Mihail Kogălniceanu.',
    ai: {
      main:
        'Tema: două reforme din domnia lui Alexandru Ioan Cuza. Secularizarea (decembrie 1863): averile mănăstirești ' +
        'au trecut la stat (aproximativ un sfert din terenul agricol). Legea rurală (august 1864): desființarea ' +
        'clăcii și a dijmei, împroprietărirea clăcașilor. Asemănări acceptate: ambele adoptate sub Cuza, de guvernul ' +
        'Mihail Kogălniceanu; ambele privesc proprietatea asupra pământului; ambele au modernizat societatea. Răspunsul ' +
        'trebuie să numească ambele reforme și să spună explicit ce au în comun; o deosebire nu se acceptă.',
      requirements: {},
    },
  },
  {
    type: 'viewpoint',
    prompt:
      'Formulați, pe baza sursei date, un punct de vedere referitor la reformele lui Alexandru Ioan Cuza, ' +
      'susținându-l cu două informații selectate din sursă.',
    template: 'viewpoint',
    sources: ['reforme'],
    count: 2,
    spans: [
      reforme('averile mănăstirești au trecut în proprietatea statului'),
      reforme('Legea rurală din 1864 a desființat claca'),
      reforme('țăranii au fost împroprietăriți'),
      reforme('a făcut învățământul primar obligatoriu și gratuit'),
    ],
    modelAnswer:
      'Consider că reformele lui Alexandru Ioan Cuza au modernizat societatea românească. Informații-suport: ' +
      '„Legea rurală din 1864 a desființat claca”; „țăranii au fost împroprietăriți”.',
    ai: {
      main:
        'Tema: reformele lui Alexandru Ioan Cuza (1863–1864), pe baza sursei: secularizarea, legea rurală, legea ' +
        'instrucțiunii publice. Puncte de vedere acceptate: reformele au modernizat societatea / statul; au îmbunătățit ' +
        'situația țăranilor. Informațiile-suport trebuie să susțină punctul de vedere. Nu este punct de vedere o simplă ' +
        'informație („Cuza a dat legea rurală”).',
      requirements: {},
    },
  },
  {
    type: 'argument',
    prompt:
      'Argumentați, printr-un fapt istoric relevant, afirmația conform căreia domnia lui Alexandru Ioan Cuza a ' +
      'modernizat statul român.',
    template: 'argument',
    sources: [],
    modelAnswer:
      'Domnia lui Alexandru Ioan Cuza a modernizat statul român, deoarece legea rurală din 1864 a desființat claca ' +
      'și i-a împroprietărit pe țărani. Așadar, afirmația este adevărată.',
    ai: {
      main:
        'Perioada: domnia lui Alexandru Ioan Cuza (1859–1866). Fapte relevante: unificarea instituțiilor (guvern și ' +
        'adunare unică, capitala la București, 1862), secularizarea averilor mănăstirești (1863), Statutul Dezvoltător ' +
        '(1864), legea rurală (1864), legea instrucțiunii publice (1864). Greșeli frecvente: Constituția din 1866 ' +
        '(adoptată după abdicarea lui Cuza), independența (1877).',
      requirements: {},
    },
  },
  {
    type: 'essay',
    prompt: 'Elaborați un eseu despre Unirea Principatelor (1857–1859).',
    template: 'essay',
    sources: [],
    requirements: [
      { id: 'r1', text: 'Prezentați o acțiune desfășurată de români în anul 1857.', modelAnswer: null, template: 'facts', argument: false },
      {
        id: 'r2',
        text: 'Formulați un punct de vedere referitor la dubla alegere a lui Alexandru Ioan Cuza și susțineți-l printr-un argument istoric.',
        modelAnswer: null,
        template: 'argument',
        argument: true,
      },
    ],
    ai: {
      main: '',
      requirements: {
        r1:
          'Acțiuni acceptate din 1857: alegerile pentru Adunările ad-hoc (falsificate în Moldova și reluate), întrunirea ' +
          'Adunărilor ad-hoc de la Iași și București, rezoluțiile din octombrie 1857 (unirea într-un stat numit România, ' +
          'prinț străin, autonomie, neutralitate, adunare reprezentativă). Prezentarea cere detalii, nu doar numele acțiunii.',
        r2:
          'Punctul de vedere este o apreciere despre dubla alegere (5 și 24 ianuarie 1859), de exemplu că a pus marile ' +
          'puteri în fața faptului împlinit. Argumentul: un fapt istoric relevant (lacuna Convenției de la Paris, ' +
          'recunoașterea dublei alegeri de către Conferința de la Paris în 1859), legat prin conectori de cauzalitate și concluzie.',
      },
    },
  },
];

export type DemoResult = {
  applied: boolean;
  action: 'create' | 'update' | 'remove' | 'nothing';
  cards: number;
  questions: number;
  exercises: number;
  templates: number;
};

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
 * Creates or refreshes the demo lesson: its node is moved before every other root node, its cards, questions,
 * sources and exercises are replaced by the ones above, and every student's progress in it is cleared (so it starts fresh). With
 * `remove`, deletes the demo node (and the lesson, by cascade) instead. Without `apply`, only plans.
 */
export async function seedDemo(client: SupabaseClient, opts: { apply: boolean; remove?: boolean }): Promise<DemoResult> {
  const { node, firstPosition } = await demoNode(client);
  const none = { cards: 0, questions: 0, exercises: 0, templates: 0 };

  if (opts.remove) {
    if (!node) return { applied: opts.apply, action: 'nothing', ...none };
    // Cascades to the lesson and its content; the shared templates stay.
    if (opts.apply) check(await client.from('nodes').delete().eq('id', node.id).select('id'), 'delete demo node');
    return { applied: opts.apply, action: 'remove', ...none };
  }

  const lessons = node
    ? (check(await client.from('lessons').select('id').eq('node_id', node.id).eq('title', DEMO_LESSON_TITLE), 'find demo lesson') as {
        id: string;
      }[])
    : [];
  const { ids: templateIds, missing } = await ensureTemplates(client, opts.apply);
  const result: DemoResult = {
    applied: opts.apply,
    action: lessons.length ? 'update' : 'create',
    cards: DEMO_CARDS.length,
    questions: DEMO_QUESTIONS.length,
    exercises: DEMO_CONSOLIDATION.length,
    templates: missing.length,
  };
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
    // Exercises before sources (their links restrict source deletes); attempts go with the exercises.
    for (const table of ['cards', 'questions', 'consolidation_exercises', 'sources', 'lesson_progress', 'consolidation_runs'] as const) {
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
  await writeConsolidation(client, lessonId, DEMO_SOURCES, DEMO_CONSOLIDATION, templateIds, randomUUID);
  return result;
}

export function formatDemo(r: DemoResult): string {
  const what =
    r.action === 'nothing'
      ? 'no demo lesson found (nothing to do)'
      : r.action === 'remove'
        ? `${r.applied ? 'removed' : 'to remove'}: node „${DEMO_NODE_TITLE}” with lesson „${DEMO_LESSON_TITLE}”`
        : `${r.applied ? (r.action === 'create' ? 'created' : 'refreshed') : `to ${r.action === 'create' ? 'create' : 'refresh'}`}: ` +
          `„${DEMO_LESSON_TITLE}” with ${r.cards} card(s), ${r.questions} question(s) and ${r.exercises} consolidation exercise(s)` +
          (r.templates ? `; ${r.templates} solution template(s) ${r.applied ? 'added' : 'to add'}` : '') +
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
