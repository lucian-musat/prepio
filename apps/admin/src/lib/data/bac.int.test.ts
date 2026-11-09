import { config } from 'dotenv';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_ESSAY_STYLE, type BacBarem } from '@prepio/shared';
import {
  createBacSubject, deleteBacItem, deleteBacSource, deleteBacSubject, getBacSubject, listBacSubjects, moveBacItem,
  saveBacItem, saveBacSource, setBacPublished, updateBacSubject, type BacItemInput,
} from './bac';
import { saveTemplate } from './templates';

config({ path: [resolve(__dirname, '../../../.env.local'), resolve(__dirname, '../../../../../.env')], quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ADMIN_EMAIL ?? 'admin@prepio.local';
const password = process.env.ADMIN_PASSWORD ?? 'prepio-local-admin';

const BODY = 'Carol I a devenit domnitor al României în 1866. Apoi a fost proclamat rege.';
const barem = (text: string, points: number, steps: number[] | null = null): BacBarem => ({ text, points, steps, essay: null });

describe.skipIf(!url || !anon || !serviceKey)('BAC subject data functions (local Supabase)', () => {
  let db: SupabaseClient;
  let service: SupabaseClient;
  let subjectId: string;
  let templateId: string;
  let srcA: string;
  let srcB: string;
  let userId: string | null = null;

  const shortItem = (templateId: string | null, sourceId?: string): BacItemInput => ({
    type: 'short_answer', prompt: '[test] Numiți domnitorul precizat în sursa A.', templateId,
    sources: sourceId ? [{ sourceId, label: 'A' }] : [], modelAnswer: null, explanation: null, creditCost: 1,
    accepted: ['Carol I'], mistakes: [], points: 2,
  });

  beforeAll(async () => {
    db = createClient(url!, anon!, { auth: { persistSession: false } });
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    service = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    templateId = (await saveTemplate(db, { title: '[test] bac șablon', exerciseType: 'short_answer', points: '', body: 'corp' })).id;
  });

  afterAll(async () => {
    if (userId) await service.auth.admin.deleteUser(userId); // its attempts go with it
    if (subjectId) {
      await service.from('bac_items').delete().eq('subject_id', subjectId);
      await service.from('bac_subjects').delete().eq('id', subjectId);
    }
    if (templateId) await db.from('solution_templates').delete().eq('id', templateId);
  });

  it('create → add sources → save a 2 p short answer → the list shows total 2', async () => {
    subjectId = await createBacSubject(db, { title: '[test] Subiect int', year: 2026, variant: 'Varianta 9', creditCost: 10 });
    srcA = (await saveBacSource(db, subjectId, 1, { title: null, author: 'Autor', work: 'Opera', body: BODY })).id;
    srcB = (await saveBacSource(db, subjectId, 1, { title: 'B', author: '', work: '', body: 'Alt text.' })).id;
    const res = await saveBacItem(db, subjectId, 1, shortItem(templateId, srcA), barem('Carol I', 2));
    expect(res.errors).toEqual([]);
    expect(res.id).toBeTruthy();

    const row = (await listBacSubjects(db)).find((s) => s.id === subjectId)!;
    expect(row).toMatchObject({ title: '[test] Subiect int', year: 2026, variant: 'Varianta 9', creditCost: 10, published: false, totalPoints: 2, itemCount: 1 });

    const full = (await getBacSubject(db, subjectId))!;
    expect(full.sources.map((s) => [s.id, s.section, s.position])).toEqual([[srcA, 1, 0], [srcB, 1, 1]]);
    expect(full.items).toHaveLength(1);
    expect(full.items[0]).toMatchObject({ type: 'short_answer', section: 1, number: 1, points: 2, templateId, sources: [{ sourceId: srcA, label: 'A' }] });
    expect(full.barems[res.id!]).toEqual(barem('Carol I', 2));
  });

  it('saveBacItem without a template returns „Alege un „Cum rezolv”.” and writes nothing', async () => {
    const res = await saveBacItem(db, subjectId, 1, shortItem(null, srcA), barem('Carol I', 2));
    expect(res.id).toBeNull();
    expect(res.errors).toContain('Alege un „Cum rezolv”.');
    expect((await getBacSubject(db, subjectId))!.items).toHaveLength(1);
  });

  it('saveBacItem refuses a source of another section', async () => {
    const other = (await saveBacSource(db, subjectId, 2, { title: null, author: '', work: '', body: 'Sursa secțiunii II.' })).id;
    const res = await saveBacItem(db, subjectId, 1, shortItem(templateId, other), barem('Carol I', 2));
    expect(res.id).toBeNull();
    expect(res.errors.join(' ')).toContain('Sursele cerinței');
    await deleteBacSource(db, other);
  });

  it('an essay saves its per-requirement barem and style', async () => {
    const reqs = [{ id: 'r1', text: 'Prezentați un fapt.', modelAnswer: null, templateId: null, argument: false }];
    const essayBarem: BacBarem = {
      text: 'Barem general', points: 10, steps: null,
      essay: { requirements: { r1: { text: 'Câte 4 p', points: 4, steps: [0, 2, 4] } }, style: DEFAULT_ESSAY_STYLE },
    };
    const res = await saveBacItem(db, subjectId, 3, {
      type: 'essay', prompt: '[test] Eseu', templateId, sources: [], modelAnswer: null, explanation: null, creditCost: 1,
      requirements: reqs, points: 10,
    }, essayBarem);
    expect(res.errors).toEqual([]);
    const full = (await getBacSubject(db, subjectId))!;
    expect(full.barems[res.id!]).toEqual(essayBarem);
    await deleteBacItem(db, res.id!);
  });

  it('items move within their section and renumber', async () => {
    const second = await saveBacItem(db, subjectId, 1, { ...shortItem(templateId), prompt: '[test] Al doilea' }, barem('X', 2));
    await moveBacItem(db, second.id!, -1);
    let items = (await getBacSubject(db, subjectId))!.items;
    expect(items.map((i) => [i.prompt, i.number])).toEqual([['[test] Al doilea', 1], ['[test] Numiți domnitorul precizat în sursa A.', 2]]);
    await deleteBacItem(db, second.id!);
    items = (await getBacSubject(db, subjectId))!.items;
    expect(items.map((i) => [i.number, i.position])).toEqual([[1, 0]]);
  });

  it('setBacPublished(true) returns the total message and stays unpublished', async () => {
    expect(await setBacPublished(db, subjectId, true)).toEqual(['Subiectul nu poate fi publicat: totalul este 2 din 90.']);
    expect((await getBacSubject(db, subjectId))!.subject.published).toBe(false);
    expect(await setBacPublished(db, subjectId, false)).toEqual([]);
  });

  it('updateBacSubject saves and validates', async () => {
    await updateBacSubject(db, subjectId, { title: '[test] Subiect int 2', year: 2025, variant: 'V1', creditCost: 12 });
    expect((await getBacSubject(db, subjectId))!.subject).toMatchObject({ title: '[test] Subiect int 2', year: 2025, variant: 'V1', creditCost: 12 });
    await expect(updateBacSubject(db, subjectId, { title: ' ', year: 2025, variant: '', creditCost: 12 })).rejects.toThrow();
    await expect(updateBacSubject(db, subjectId, { title: 'X', year: 2025, variant: '', creditCost: 51 })).rejects.toThrow();
  });

  it('deleteBacSource of a linked source is refused; an unused one is deleted', async () => {
    await expect(deleteBacSource(db, srcA)).rejects.toThrow('Sursa este folosită de un exercițiu.');
    await deleteBacSource(db, srcB);
    expect((await getBacSubject(db, subjectId))!.sources.map((s) => s.id)).toEqual([srcA]);
  });

  it('deleteBacSubject with an attempt is refused', async () => {
    const u = await service.auth.admin.createUser({ email: `test-bac-admin-${randomUUID()}@prepio.local`, password: 'test-password-123', email_confirm: true });
    if (u.error) throw u.error;
    userId = u.data.user.id;
    const a = await service.from('bac_attempts').insert({ user_id: userId, subject_id: subjectId });
    if (a.error) throw a.error;
    await expect(deleteBacSubject(db, subjectId)).rejects.toThrow(
      'Subiectul are lucrări ale elevilor; retrage-l din publicare în loc să-l ștergi.',
    );
    await service.auth.admin.deleteUser(userId);
    userId = null;
  });

  it('deleteBacSubject removes the subject with its items and sources', async () => {
    await deleteBacSubject(db, subjectId);
    expect(await getBacSubject(db, subjectId)).toBeNull();
    subjectId = '';
  });
});
