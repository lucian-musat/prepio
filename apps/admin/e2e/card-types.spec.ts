import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { createLesson, createNode } from '../src/lib/data/tree';

// One card of each type through the editor, with the live student preview (needs the student web on :8081).
config({ path: [resolve(__dirname, '../.env.local'), resolve(__dirname, '../../../.env')], quiet: true });

const SB_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!;
const SB_ANON = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!;
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const EMAIL = process.env.ADMIN_EMAIL ?? 'admin@prepio.local';
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'prepio-local-admin';
// KEEP_TEST_LESSON=1 leaves the long-content lesson (published) for walking it in the student app.
const KEEP = process.env.KEEP_TEST_LESSON === '1';

// 1x1 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

let db: SupabaseClient;
let service: SupabaseClient;

test.beforeAll(async () => {
  db = createClient(SB_URL, SB_ANON, { auth: { persistSession: false } });
  const { error } = await db.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error) throw error;
  service = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
});

/** Ids of the test rows, recorded as soon as each exists, so a partial setup is still cleaned up. */
type TestLesson = { rootId?: string; lessonId?: string };

/** Creates `[test]` root → chapter → lesson into `t` (deleting the root cascades to the rest). */
async function createTestLesson(t: TestLesson, name: string) {
  t.rootId = (await createNode(db, null, `[test] ${name} ${Date.now()}`)).id;
  const node = await createNode(db, t.rootId, '[test] capitol');
  t.lessonId = (await createLesson(db, node.id, `[test] ${name}`)).id;
}

/** Removes the lesson's uploaded images (saved or not) and the test tree; each step runs even if the other fails. */
async function removeTestLesson(t: TestLesson) {
  const failures: string[] = [];
  if (t.lessonId) {
    const folder = `lessons/${t.lessonId}`;
    try {
      const listed = await service.storage.from('images').list(folder, { limit: 1000 });
      if (listed.error) throw listed.error;
      if (listed.data.length) {
        const removed = await service.storage.from('images').remove(listed.data.map((f) => `${folder}/${f.name}`));
        if (removed.error) throw removed.error;
      }
    } catch (e) {
      failures.push(`images in ${folder}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (t.rootId) {
    const { error } = await service.from('nodes').delete().eq('id', t.rootId);
    if (error) failures.push(`node ${t.rootId}: ${error.message}`);
  }
  if (failures.length) throw new Error(`[test] cleanup failed: ${failures.join('; ')}`);
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Parolă').fill(PASSWORD);
  await page.getByRole('button', { name: 'Intră' }).click();
  await expect(page).toHaveURL('http://localhost:3000/');
}

const cardForm = (page: Page) => page.getByTestId('card-form');
const preview = (page: Page) => page.frameLocator('iframe[title="Previzualizare card"]');

async function newCard(page: Page, type: string, title: string) {
  await page.getByRole('button', { name: 'Adaugă card' }).click();
  const form = cardForm(page);
  await form.getByLabel('Titlu (opțional)').fill(title);
  if (type !== 'Text') await form.getByRole('radiogroup', { name: 'Tipul cardului' }).getByText(type, { exact: true }).click();
  return form;
}

async function save(page: Page, count: number) {
  await cardForm(page).getByRole('button', { name: 'Salvează' }).click();
  await expect(page.getByTestId('card-item')).toHaveCount(count);
}

/** Fills date and title of timeline point `i` (0-based), adding the point first. */
async function addPoint(form: Locator, i: number, date: string, title: string) {
  await form.getByRole('button', { name: '+ Adaugă punct' }).click();
  await form.getByLabel('Data', { exact: true }).nth(i).fill(date);
  await form.getByLabel('Titlu', { exact: true }).nth(i).fill(title);
}

async function fillSchema(form: Locator, cause: string, central: string, consequence: string) {
  const causes = form.getByRole('group', { name: 'Cauze' });
  await causes.getByRole('button', { name: '+ Adaugă cauză' }).click();
  await causes.getByLabel('Text', { exact: true }).fill(cause);
  await form.getByRole('group', { name: 'Eveniment central' }).getByLabel('Text', { exact: true }).fill(central);
  const consequences = form.getByRole('group', { name: 'Urmări' });
  await consequences.getByRole('button', { name: '+ Adaugă urmare' }).click();
  await consequences.getByLabel('Text', { exact: true }).fill(consequence);
}

test.describe('card types', () => {
  const lesson: TestLesson = {};
  test.beforeAll(async () => {
    await createTestLesson(lesson, 'tipuri de carduri');
  });
  test.afterAll(async () => {
    await removeTestLesson(lesson);
  });

  test('one card of each type, with the live student preview', async ({ page }) => {
    await login(page);
    await page.goto(`/lessons/${lesson.lessonId}`);

    // Text
    let form = await newCard(page, 'Text', 'Reformele lui Cuza');
    await form.getByRole('textbox', { name: 'Text', exact: true }).fill('Domnia lui **Cuza** a adus reforme.');
    await save(page, 1);

    // Images, with alt text
    form = await newCard(page, 'Imagini', 'Harta');
    await form.getByLabel('Încarcă imagini').setInputFiles({ name: 'harta.png', mimeType: 'image/png', buffer: PNG });
    await form.getByLabel('Descriere (alt)').fill('Harta Principatelor Unite');
    await save(page, 2);

    // Video: a fragment
    form = await newCard(page, 'Video', 'Documentar');
    await form.getByLabel('Link YouTube').fill('https://youtu.be/dQw4w9WgXcQ');
    await expect(form.getByText('Video recunoscut ✓')).toBeVisible();
    await form.getByLabel('Start (secunde)').fill('10');
    await form.getByLabel('Final (secunde)').fill('70');
    await save(page, 3);

    // Timeline: the preview follows the typing, on phone and desktop
    form = await newCard(page, 'Axă cronologică', 'Cronologie');
    await addPoint(form, 0, '24 ianuarie 1859', 'Unirea Principatelor');
    await expect(preview(page).getByText('Unirea Principatelor')).toBeVisible();
    await expect(preview(page).getByText('Cartonaș 4 din 4')).toBeVisible();
    const size = form.getByRole('radiogroup', { name: 'Dimensiunea previzualizării' });
    await size.getByText('Desktop', { exact: true }).click();
    await expect(size.getByRole('radio', { name: 'Desktop', exact: true })).toBeChecked();
    await expect(preview(page).getByText('Unirea Principatelor')).toBeVisible();
    await size.getByText('Telefon', { exact: true }).click();
    await addPoint(form, 1, '1 decembrie 1918', 'Marea Unire');
    await expect(preview(page).getByText('Marea Unire')).toBeVisible();
    await save(page, 4);

    // Schema
    form = await newCard(page, 'Schemă', 'Cauze și urmări');
    await fillSchema(form, 'Voința populară', 'Unirea din 1859', 'Statul român modern');
    await save(page, 5);

    // Link, filled by hand (no autofill: the network may be unavailable)
    form = await newCard(page, 'Link', 'Lectură');
    await form.getByLabel('URL').fill('https://ro.wikipedia.org/wiki/Mica_Unire');
    await form.getByLabel('Titlul paginii').fill('Mica Unire');
    await form.getByLabel('Descriere', { exact: true }).fill('Articol despre Unirea Principatelor.');
    await save(page, 6);

    const summaries = [
      'Domnia lui Cuza a adus reforme.',
      '1 imagine',
      'YouTube · dQw4w9WgXcQ · 10s–70s',
      '2 puncte',
      '1 cauză → Unirea din 1859 → 1 urmare',
      'ro.wikipedia.org',
    ];
    const titles = ['Reformele lui Cuza', 'Harta', 'Documentar', 'Cronologie', 'Cauze și urmări', 'Lectură'];
    const checkList = async () => {
      const items = page.getByTestId('card-item');
      await expect(items).toHaveCount(6);
      for (const [i, summary] of summaries.entries()) {
        await expect(items.nth(i)).toContainText(titles[i]);
        await expect(items.nth(i)).toContainText(summary);
      }
    };
    await checkList();
    await page.reload();
    await checkList();

    // Editing an existing card previews it at its position
    await page.getByTestId('card-item').nth(1).getByRole('button', { name: 'Editează' }).click();
    await expect(preview(page).getByText('Cartonaș 2 din 6')).toBeVisible();
    await cardForm(page).getByRole('button', { name: 'Anulează' }).click();
  });
});

test.describe('card types: long content', () => {
  const lesson: TestLesson = {};
  test.beforeAll(async () => {
    await createTestLesson(lesson, 'conținut lung');
  });
  test.afterAll(async () => {
    if (KEEP && lesson.lessonId) {
      console.log(`KEEP_TEST_LESSON=1: kept lesson ${lesson.lessonId} (root node ${lesson.rootId})`);
      return;
    }
    await removeTestLesson(lesson);
  });

  test('20 timeline points, 200-character schema boxes, a 120-character URL', async ({ page }) => {
    test.setTimeout(120_000);
    const long = (seed: string, n: number) => seed.repeat(Math.ceil(n / seed.length)).slice(0, n);
    const box = (label: string) => long(`${label} — o explicație lungă a contextului istoric. `, 200);
    const url = `https://ro.wikipedia.org/wiki/${long('Unirea_Principatelor_Romane_', 120 - 'https://ro.wikipedia.org/wiki/'.length)}`;
    expect(url).toHaveLength(120);

    await login(page);
    await page.goto(`/lessons/${lesson.lessonId}`);

    let form = await newCard(page, 'Axă cronologică', 'Cronologia secolului XIX');
    for (let i = 0; i < 20; i++) await addPoint(form, i, `${1800 + i * 5}`, `Evenimentul ${i + 1} din cronologia lungă`);
    await expect(preview(page).getByText('Evenimentul 20 din cronologia lungă')).toBeVisible();
    await save(page, 1);

    form = await newCard(page, 'Schemă', 'Schemă cu text lung');
    await fillSchema(form, box('Cauza'), box('Evenimentul'), box('Urmarea'));
    await save(page, 2);

    form = await newCard(page, 'Link', 'Link lung');
    await form.getByLabel('URL').fill(url);
    await form.getByLabel('Titlul paginii').fill(long('Un titlu de pagină foarte lung despre Unirea Principatelor ', 150));
    await save(page, 3);

    const items = page.getByTestId('card-item');
    await expect(items.nth(0)).toContainText('20 puncte');
    await expect(items.nth(2)).toContainText('ro.wikipedia.org');

    // published, so the student app can show it when kept
    await page.getByRole('button', { name: 'Publică' }).click();
    await expect(page.getByTestId('lesson-status')).toHaveText('Publicată');
  });
});
