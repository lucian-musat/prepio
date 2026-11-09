import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_ESSAY_STYLE, bacItemFromRow, exerciseToRow, reanchorSpan, sourceFromRow, templateFromRow, validateBacItem, validateBacSubject,
  type BacBarem, type BacEssayStyle, type BacItem, type BacSection, type BacStepRule, type BacSubjectSummary, type ConsolidationType,
  type DistributiveOmit, type SolutionTemplate, type Source, type SourceLabel, type SourceRef,
} from '@prepio/shared';
import { GENERIC_ERROR, UserError, check, checkAffected, renumber, swapInGroup, type PositionRow } from './db';
import { mapSpans, normalizeExercise, spansOf, type ExerciseInput, type SourceImpact, type SourceInput } from './consolidation';

export type BacSubjectInput = { title: string; year: number; variant: string; creditCost: number };
export type BacSubjectListRow = BacSubjectSummary & { published: boolean; totalPoints: number; itemCount: number };
export type BacSource = Source & { section: BacSection };
/** What the item form sends: the exercise fields plus the points (no AI context on BAC items). */
export type BacItemInput = DistributiveOmit<BacItem, 'id' | 'position' | 'section' | 'number'> & { id?: string };
export type BacSubjectForEdit = {
  subject: BacSubjectSummary & { published: boolean };
  /** Ordered by section, then position. */
  sources: BacSource[];
  /** Ordered by section, then position; `number` is 1-based within the section. */
  items: BacItem[];
  /** By item id. */
  barems: Record<string, BacBarem>;
  /** By item id: `validateBacItem` messages. */
  errors: Record<string, string[]>;
  templates: SolutionTemplate[];
};

export const MIN_BAC_CREDIT_COST = 1;
export const MAX_BAC_CREDIT_COST = 50;
const HAS_ATTEMPTS = 'Subiectul are lucrări ale elevilor; retrage-l din publicare în loc să-l ștergi.';
const SOURCE_USED = 'Sursa este folosită de un exercițiu.';
const SUBJECT_COLUMNS = 'id,title,year,variant,credit_cost,published';
const SOURCE_COLUMNS = 'id,section,position,title,author,work,body';
const ITEM_COLUMNS = 'id,section,position,type,prompt,content,template_id,points';

type SubjectRow = { id: string; title: string; year: number; variant: string; credit_cost: number; published: boolean };
type ItemRow = { id: string; section: number; position: number; type: ConsolidationType; prompt: string; content: Record<string, unknown>; template_id: string | null; points: number };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isSection = (v: unknown): v is BacSection => v === 1 || v === 2 || v === 3;
const subjectFromRow = (r: SubjectRow) => ({
  id: r.id, title: r.title, year: r.year, variant: r.variant, creditCost: r.credit_cost, published: r.published,
});

// ---------------------------------------------------------------- barem (untrusted JSON / input)

function stepsFrom(v: unknown): number[] | null {
  if (!Array.isArray(v)) return null;
  return [...new Set(v.filter((s): s is number => Number.isInteger(s)))].sort((a, b) => a - b);
}
function ruleFrom(v: unknown, points: number): BacStepRule {
  const o = isObj(v) ? v : {};
  return { text: typeof o.text === 'string' ? o.text.trim() : '', points, steps: stepsFrom(o.steps) };
}
function styleFrom(v: unknown): BacEssayStyle {
  const o = isObj(v) ? v : {};
  const n = (x: unknown, d: number) => (Number.isInteger(x) && (x as number) >= 0 ? (x as number) : d);
  return {
    language: n(o.language, DEFAULT_ESSAY_STYLE.language),
    structure: n(o.structure, DEFAULT_ESSAY_STYLE.structure),
    order: n(o.order, DEFAULT_ESSAY_STYLE.order),
    length: n(o.length, DEFAULT_ESSAY_STYLE.length),
  };
}
/** The item's barem with `points` = the item's; the essay part keeps only the item's requirement ids. */
export function baremFrom(v: unknown, item: Pick<BacItem, 'points'> & ({ type: 'essay'; requirements: { id: string }[] } | { type: Exclude<ConsolidationType, 'essay'> })): BacBarem {
  const o = isObj(v) ? v : {};
  const base = ruleFrom(o, item.points);
  if (item.type !== 'essay') return { ...base, essay: null };
  const e = isObj(o.essay) ? o.essay : {};
  const reqs = isObj(e.requirements) ? e.requirements : {};
  const requirements: Record<string, BacStepRule> = {};
  for (const r of item.requirements) {
    const raw = isObj(reqs[r.id]) ? (reqs[r.id] as Record<string, unknown>) : {};
    requirements[r.id] = ruleFrom(raw, Number.isInteger(raw.points) ? (raw.points as number) : 0);
  }
  return { ...base, essay: { requirements, style: styleFrom(e.style) } };
}

// ---------------------------------------------------------------- subjects

export async function listBacSubjects(db: SupabaseClient): Promise<BacSubjectListRow[]> {
  const [subjects, items] = await Promise.all([
    db.from('bac_subjects').select(SUBJECT_COLUMNS).order('year', { ascending: false }).order('title').order('id'),
    db.from('bac_items').select('subject_id,points'),
  ]);
  const totals = new Map<string, { points: number; count: number }>();
  for (const i of check(items) as unknown as Array<{ subject_id: string; points: number }>) {
    const t = totals.get(i.subject_id) ?? { points: 0, count: 0 };
    totals.set(i.subject_id, { points: t.points + i.points, count: t.count + 1 });
  }
  return (check(subjects) as unknown as SubjectRow[]).map((r) => ({
    ...subjectFromRow(r),
    totalPoints: totals.get(r.id)?.points ?? 0,
    itemCount: totals.get(r.id)?.count ?? 0,
  }));
}

async function loadSources(db: SupabaseClient, subjectId: string): Promise<BacSource[]> {
  const rows = check(
    await db.from('bac_sources').select(SOURCE_COLUMNS).eq('subject_id', subjectId).order('section').order('position').order('id'),
  ) as unknown as Array<Record<string, unknown> & { section: BacSection }>;
  return rows.map((r) => ({ ...sourceFromRow(r), section: r.section }));
}

async function loadItems(db: SupabaseClient, subjectId: string): Promise<{ items: BacItem[]; barems: Record<string, BacBarem> }> {
  const rows = check(
    await db.from('bac_items').select(ITEM_COLUMNS).eq('subject_id', subjectId).order('section').order('position').order('id'),
  ) as unknown as ItemRow[];
  if (rows.length === 0) return { items: [], barems: {} };
  const ids = rows.map((r) => r.id);
  const [links, baremRows] = await Promise.all([
    db.from('bac_item_sources').select('item_id,label,source_id').in('item_id', ids).order('position').order('label'),
    db.from('bac_item_barem').select('item_id,barem').in('item_id', ids),
  ]);
  const refs = new Map<string, SourceRef[]>();
  for (const l of check(links) as unknown as Array<{ item_id: string; label: string; source_id: string }>) {
    const list = refs.get(l.item_id) ?? [];
    list.push({ sourceId: l.source_id, label: l.label as SourceLabel });
    refs.set(l.item_id, list);
  }
  const rawBarem = new Map((check(baremRows) as unknown as Array<{ item_id: string; barem: unknown }>).map((b) => [b.item_id, b.barem]));
  const numbers = new Map<number, number>();
  const barems: Record<string, BacBarem> = {};
  const items = rows.map((r) => {
    const number = (numbers.get(r.section) ?? 0) + 1;
    numbers.set(r.section, number);
    const item = bacItemFromRow(r, number, refs.get(r.id) ?? []);
    barems[item.id] = baremFrom(rawBarem.get(item.id), item);
    return item;
  });
  return { items, barems };
}

const sectionSources = (sources: BacSource[], section: number) => sources.filter((s) => s.section === section);

/** A section holds at most two sources; their letters (A, B by position) are also the labels of the item links. */
export const MAX_SECTION_SOURCES = 2;
const TOO_MANY_SOURCES = 'O secțiune poate avea cel mult 2 surse.';
const LETTERS: SourceLabel[] = ['A', 'B'];

/** Source id -> its letter within the section (`sources` = the section's, in position order). */
const sectionLetters = (sources: BacSource[]) => new Map(sources.slice(0, MAX_SECTION_SOURCES).map((s, i) => [s.id, LETTERS[i]!]));

/**
 * Rewrites the item links of the section so each label equals its source's section letter (after a move or a delete).
 * A `source_letter` item's correct letter follows its source.
 */
async function relabelSection(db: SupabaseClient, subjectId: string, section: BacSection): Promise<void> {
  const sources = sectionSources(await loadSources(db, subjectId), section);
  if (sources.length === 0) return;
  const letters = sectionLetters(sources);
  const links = check(
    await db.from('bac_item_sources').select('item_id,label,source_id').in('source_id', sources.map((s) => s.id)),
  ) as unknown as Array<{ item_id: string; label: string; source_id: string }>;
  const byItem = new Map<string, typeof links>();
  for (const l of links) byItem.set(l.item_id, [...(byItem.get(l.item_id) ?? []), l]);
  for (const [itemId, own] of byItem) {
    if (own.every((l) => letters.get(l.source_id) === l.label)) continue;
    const renamed = new Map(own.map((l) => [l.label, letters.get(l.source_id)!]));
    const next = own.map((l) => ({ source_id: l.source_id, label: letters.get(l.source_id)! })).sort((a, b) => a.label.localeCompare(b.label));
    // delete + insert: swapping two labels in place would collide on the (item_id, label) key
    check(await db.from('bac_item_sources').delete().eq('item_id', itemId));
    check(await db.from('bac_item_sources').insert(next.map((l, position) => ({ item_id: itemId, ...l, position }))));
    const row = check(await db.from('bac_items').select('type,content').eq('id', itemId).single()) as { type: string; content: Record<string, unknown> };
    const correct = row.content?.correct;
    if (row.type === 'source_letter' && typeof correct === 'string' && renamed.has(correct) && renamed.get(correct) !== correct) {
      checkAffected(await db.from('bac_items').update({ content: { ...row.content, correct: renamed.get(correct) } }).eq('id', itemId).select('id'));
    }
  }
}

export async function getBacSubject(db: SupabaseClient, id: string): Promise<BacSubjectForEdit | null> {
  const subject = check(await db.from('bac_subjects').select(SUBJECT_COLUMNS).eq('id', id).maybeSingle()) as SubjectRow | null;
  if (!subject) return null;
  const [sources, { items, barems }, templates] = await Promise.all([
    loadSources(db, id),
    loadItems(db, id),
    db.from('solution_templates').select('id,title,exercise_type,points,body').order('title').order('id'),
  ]);
  const errors: Record<string, string[]> = {};
  for (const item of items) errors[item.id] = validateBacItem(item, sectionSources(sources, item.section), barems[item.id] ?? null);
  return {
    subject: subjectFromRow(subject),
    sources,
    items,
    barems,
    errors,
    templates: (check(templates) as Record<string, unknown>[]).map(templateFromRow),
  };
}

function subjectFields(input: BacSubjectInput) {
  const title = typeof input?.title === 'string' ? input.title.trim() : '';
  if (!title) throw new UserError('Titlul nu poate fi gol.');
  if (!Number.isInteger(input.year) || input.year < 2000 || input.year > 2100) throw new UserError('Anul trebuie să fie între 2000 și 2100.');
  const c = input.creditCost;
  if (!Number.isInteger(c) || c < MIN_BAC_CREDIT_COST || c > MAX_BAC_CREDIT_COST) {
    throw new UserError(`Costul trebuie să fie între ${MIN_BAC_CREDIT_COST} și ${MAX_BAC_CREDIT_COST} de credite.`);
  }
  return { title, year: input.year, variant: typeof input.variant === 'string' ? input.variant.trim() : '', credit_cost: c };
}

export async function createBacSubject(db: SupabaseClient, input: BacSubjectInput): Promise<string> {
  const row = check(await db.from('bac_subjects').insert(subjectFields(input)).select('id').single()) as { id: string };
  return row.id;
}

export async function updateBacSubject(db: SupabaseClient, id: string, input: BacSubjectInput): Promise<void> {
  checkAffected(await db.from('bac_subjects').update(subjectFields(input)).eq('id', id).select('id'));
}

export async function deleteBacSubject(db: SupabaseClient, id: string): Promise<void> {
  const attempts = check(await db.from('bac_attempts').select('id').eq('subject_id', id).limit(1)) as unknown[];
  if (attempts.length) throw new UserError(HAS_ATTEMPTS);
  // Items first: their source links restrict deleting the sources that the subject's cascade would remove.
  check(await db.from('bac_items').delete().eq('subject_id', id));
  checkAffected(await db.from('bac_subjects').delete().eq('id', id).select('id'));
}

/** Empty when saved; otherwise the messages that block publishing (nothing is written). */
export async function setBacPublished(db: SupabaseClient, id: string, published: boolean): Promise<string[]> {
  if (published) {
    const data = await getBacSubject(db, id);
    if (!data) throw new UserError('Subiectul nu există.');
    const messages = validateBacSubject(data.items, new Map(Object.entries(data.errors)));
    if (messages.length) return messages;
  }
  checkAffected(await db.from('bac_subjects').update({ published: published === true }).eq('id', id).select('id'));
  return [];
}

// ---------------------------------------------------------------- sources

async function sourceRow(db: SupabaseClient, id: string): Promise<{ subject_id: string; section: BacSection }> {
  const row = check(await db.from('bac_sources').select('subject_id,section').eq('id', id).maybeSingle()) as { subject_id: string; section: BacSection } | null;
  if (!row) throw new UserError('Sursa nu există.');
  return row;
}

async function sectionRows(db: SupabaseClient, table: 'bac_sources' | 'bac_items', subjectId: string, section: number): Promise<PositionRow[]> {
  return check(
    await db.from(table).select('id,position').eq('subject_id', subjectId).eq('section', section).order('position').order('id'),
  ) as PositionRow[];
}

async function nextPosition(db: SupabaseClient, table: 'bac_sources' | 'bac_items', subjectId: string, section: number) {
  const rows = await sectionRows(db, table, subjectId, section);
  return rows.length ? Math.max(...rows.map((r) => r.position)) + 1 : 0;
}

/** The subject's items that link the source (with their stored barem untouched). */
async function itemsUsing(db: SupabaseClient, subjectId: string, sourceId: string): Promise<BacItem[]> {
  const links = check(await db.from('bac_item_sources').select('item_id').eq('source_id', sourceId)) as unknown as Array<{ item_id: string }>;
  if (links.length === 0) return [];
  const ids = new Set(links.map((l) => l.item_id));
  return (await loadItems(db, subjectId)).items.filter((i) => ids.has(i.id));
}

export async function bacSourceImpact(db: SupabaseClient, sourceId: string, newBody: string): Promise<SourceImpact> {
  const { subject_id } = await sourceRow(db, sourceId);
  const impact: SourceImpact = [];
  for (const item of await itemsUsing(db, subject_id, sourceId)) {
    const detached = spansOf(item).filter((s) => s.sourceId === sourceId && reanchorSpan(newBody, s) === null).map((s) => s.text);
    if (detached.length) impact.push({ exerciseId: item.id, prompt: item.prompt, detached });
  }
  return impact;
}

/** Saves the source and re-anchors the spans of the items that point at it (as the consolidation sources do). */
export async function saveBacSource(db: SupabaseClient, subjectId: string, section: BacSection, input: SourceInput): Promise<{ id: string }> {
  if (!isSection(section)) throw new UserError(GENERIC_ERROR);
  if (typeof input?.body !== 'string' || !input.body.trim()) throw new UserError('Textul sursei nu poate fi gol.');
  const orNull = (s: unknown) => (typeof s === 'string' && s.trim() !== '' ? s.trim() : null);
  const fields = {
    title: orNull(input.title),
    author: typeof input.author === 'string' ? input.author.trim() : '',
    work: typeof input.work === 'string' ? input.work.trim() : '',
    body: input.body.trim(),
  };
  if (!input.id) {
    if ((await sectionRows(db, 'bac_sources', subjectId, section)).length >= MAX_SECTION_SOURCES) throw new UserError(TOO_MANY_SOURCES);
    const position = await nextPosition(db, 'bac_sources', subjectId, section);
    const row = check(
      await db.from('bac_sources').insert({ ...fields, subject_id: subjectId, section, position }).select('id').single(),
    ) as { id: string };
    return { id: row.id };
  }
  checkAffected(await db.from('bac_sources').update(fields).eq('id', input.id).eq('subject_id', subjectId).select('id'));
  for (const item of await itemsUsing(db, subjectId, input.id)) {
    let changed = false;
    const next = mapSpans(item, (s) => {
      if (s.sourceId !== input.id) return s;
      const moved = reanchorSpan(fields.body, s);
      if (!moved) return s; // detached: kept, validateBacItem reports it
      if (moved.start !== s.start || moved.end !== s.end || moved.limitStart !== s.limitStart || moved.limitEnd !== s.limitEnd) changed = true;
      return moved;
    });
    if (!changed) continue;
    checkAffected(await db.from('bac_items').update({ content: itemRow(next as BacItem).content }).eq('id', item.id).select('id'));
  }
  return { id: input.id };
}

export async function deleteBacSource(db: SupabaseClient, id: string): Promise<void> {
  const { subject_id, section } = await sourceRow(db, id);
  const used = check(await db.from('bac_item_sources').select('item_id').eq('source_id', id).limit(1)) as unknown[];
  if (used.length) throw new UserError(SOURCE_USED);
  checkAffected(await db.from('bac_sources').delete().eq('id', id).select('id'));
  const rows = await sectionRows(db, 'bac_sources', subject_id, section);
  await renumber(db, 'bac_sources', rows.map((r) => r.id), rows);
  await relabelSection(db, subject_id, section);
}

export async function moveBacSource(db: SupabaseClient, id: string, dir: -1 | 1): Promise<void> {
  const { subject_id, section } = await sourceRow(db, id);
  await swapInGroup(db, 'bac_sources', await sectionRows(db, 'bac_sources', subject_id, section), id, dir === -1 ? 'up' : 'down');
  await relabelSection(db, subject_id, section);
}

// ---------------------------------------------------------------- items

/** Row fields; the BAC-only fields and the consolidation credit cost are not part of `content`. */
function itemRow(item: BacItem) {
  const { id: _id, position: _p, sources: _s, section: _sec, number: _n, points, ...ex } = item;
  const row = exerciseToRow(ex as Parameters<typeof exerciseToRow>[0]);
  return { type: row.type, prompt: row.prompt, content: row.content, template_id: row.template_id, points };
}

async function itemRowOf(db: SupabaseClient, id: string): Promise<{ subject_id: string; section: BacSection }> {
  const row = check(await db.from('bac_items').select('subject_id,section').eq('id', id).maybeSingle()) as { subject_id: string; section: BacSection } | null;
  if (!row) throw new UserError('Cerința nu există.');
  return row;
}

/** Validates with `validateBacItem`: `errors` non-empty means nothing was written. */
export async function saveBacItem(
  db: SupabaseClient, subjectId: string, section: BacSection, input: BacItemInput, baremInput: BacBarem,
): Promise<{ id: string | null; errors: string[] }> {
  if (!isSection(section) || !isObj(input)) throw new UserError(GENERIC_ERROR);
  const ex = normalizeExercise({ ...(input as object), ai: { main: '', requirements: {}, templateId: null, requirementTemplates: {} } } as ExerciseInput);
  const points = typeof input.points === 'number' ? input.points : Number.NaN;
  const item: BacItem = { ...ex, section, number: 0, points };
  const barem = baremFrom(baremInput, item);

  const sources = sectionSources(await loadSources(db, subjectId), section);
  const own = new Set(sources.map((s) => s.id));
  const linked = item.sources.map((s) => s.sourceId);
  if (linked.some((id) => !own.has(id)) || new Set(linked).size !== linked.length) {
    return { id: null, errors: ['Sursele cerinței trebuie să fie din aceeași secțiune și diferite.'] };
  }
  // The link label is the source's letter in the section (the prompt says „sursa B”), not its slot in the item.
  const letters = sectionLetters(sources);
  item.sources = item.sources
    .map((s) => ({ sourceId: s.sourceId, label: letters.get(s.sourceId)! }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const templateIds = new Set<string>();
  if (item.templateId) templateIds.add(item.templateId);
  if (item.type === 'essay') for (const r of item.requirements) if (r.templateId) templateIds.add(r.templateId);
  if (templateIds.size) {
    const found = check(await db.from('solution_templates').select('id').in('id', [...templateIds])) as unknown[];
    if (found.length !== templateIds.size) return { id: null, errors: ['Șablonul ales nu există.'] };
  }

  const errors = validateBacItem(item, sources, barem);
  if (errors.length) return { id: null, errors };

  const fields = itemRow(item);
  let id: string;
  if (input.id) {
    checkAffected(
      await db.from('bac_items').update(fields).eq('id', input.id).eq('subject_id', subjectId).eq('section', section).select('id'),
    );
    id = input.id;
  } else {
    const position = await nextPosition(db, 'bac_items', subjectId, section);
    const row = check(await db.from('bac_items').insert({ ...fields, subject_id: subjectId, section, position }).select('id').single()) as { id: string };
    id = row.id;
  }
  check(await db.from('bac_item_sources').delete().eq('item_id', id));
  if (item.sources.length) {
    check(
      await db.from('bac_item_sources').insert(
        item.sources.map((s, position) => ({ item_id: id, source_id: s.sourceId, label: s.label, position })),
      ),
    );
  }
  check(await db.from('bac_item_barem').upsert({ item_id: id, barem }));
  return { id, errors: [] };
}

export async function deleteBacItem(db: SupabaseClient, id: string): Promise<void> {
  const { subject_id, section } = await itemRowOf(db, id);
  checkAffected(await db.from('bac_items').delete().eq('id', id).select('id'));
  const rows = await sectionRows(db, 'bac_items', subject_id, section);
  await renumber(db, 'bac_items', rows.map((r) => r.id), rows);
}

export async function moveBacItem(db: SupabaseClient, id: string, dir: -1 | 1): Promise<void> {
  const { subject_id, section } = await itemRowOf(db, id);
  await swapInGroup(db, 'bac_items', await sectionRows(db, 'bac_items', subject_id, section), id, dir === -1 ? 'up' : 'down');
}
