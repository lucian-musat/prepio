import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';
import { createLesson, createNode } from '../src/lib/data/tree';

config({ path: [resolve(__dirname, '../.env.local'), resolve(__dirname, '../../../.env')], quiet: true });

const SB_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!;
const SB_ANON = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!;
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const EMAIL = process.env.ADMIN_EMAIL ?? 'admin@prepio.local';
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'prepio-local-admin';
// A student: signed in but not in `admins` (anon reads no content at all).
const STUDENT = { email: `e2e-student-${Date.now()}@prepio.local`, password: 'e2e-student-password' };

// 1x1 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

let db: SupabaseClient;
let service: SupabaseClient;
let student: SupabaseClient;
let studentId: string | null = null;
let rootId: string;
let lessonId: string;

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Parolă').fill(PASSWORD);
  await page.getByRole('button', { name: 'Intră' }).click();
  await expect(page).toHaveURL('http://localhost:3000/');
}

test.beforeAll(async () => {
  db = createClient(SB_URL, SB_ANON, { auth: { persistSession: false } });
  const { error } = await db.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error) throw error;

  service = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
  const created = await service.auth.admin.createUser({ ...STUDENT, email_confirm: true });
  if (created.error) throw created.error;
  studentId = created.data.user.id;
  student = createClient(SB_URL, SB_ANON, { auth: { persistSession: false } });
  const signIn = await student.auth.signInWithPassword(STUDENT);
  if (signIn.error) throw signIn.error;

  rootId = (await createNode(db, null, `[test] editor ${Date.now()}`)).id;
  const node = await createNode(db, rootId, '[test] capitol');
  lessonId = (await createLesson(db, node.id, '[test] lecție editor')).id;
});

// Each step runs even if another fails; failures are reported together.
test.afterAll(async () => {
  const failures: string[] = [];
  const step = async (what: string, fn: () => Promise<{ error: { message: string } | null }>) => {
    try {
      const { error } = await fn();
      if (error) failures.push(`${what}: ${error.message}`);
    } catch (e) {
      failures.push(`${what}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  // every upload of the lesson, also when the test failed before reading the saved path
  if (lessonId) {
    const folder = `lessons/${lessonId}`;
    await step(`images in ${folder}`, async () => {
      const listed = await service.storage.from('images').list(folder, { limit: 1000 });
      if (listed.error || !listed.data.length) return listed;
      return service.storage.from('images').remove(listed.data.map((f) => `${folder}/${f.name}`));
    });
  }
  if (rootId) await step(`node ${rootId}`, async () => db.from('nodes').delete().eq('id', rootId)); // cascades
  if (studentId) await step(`user ${studentId}`, async () => service.auth.admin.deleteUser(studentId!));
  if (failures.length) throw new Error(`[test] cleanup failed: ${failures.join('; ')}`);
});

test('lesson editor: card with image, three question types, exercise, reorder, publish, student visibility', async ({ page }) => {
  await login(page);
  await page.goto(`/lessons/${lessonId}`);
  await expect(page.getByLabel('Titlul lecției')).toHaveValue('[test] lecție editor');

  // Title
  await page.getByLabel('Titlul lecției').fill('[test] lecție completă');
  await page.getByRole('button', { name: 'Salvează titlul' }).click();
  await expect(page.getByText('Titlul a fost salvat.')).toBeVisible();

  // Cards: an images card (alt text, credit, text under the image)
  await page.getByRole('button', { name: 'Adaugă card' }).click();
  const cardForm = page.getByTestId('card-form');
  await cardForm.getByLabel('Titlu (opțional)').fill('Unirea');
  await cardForm.getByRole('radiogroup', { name: 'Tipul cardului' }).getByText('Imagini', { exact: true }).click();
  await cardForm.getByLabel('Încarcă imagini').setInputFiles({ name: 'harta.png', mimeType: 'image/png', buffer: PNG });
  await expect(cardForm.getByLabel('Descriere (alt)')).toBeVisible();
  await cardForm.getByLabel('Descriere (alt)').fill('Harta Principatelor');
  await cardForm.getByLabel('Sursa / creditul imaginii').fill('Wikimedia Commons');
  await cardForm.getByLabel('Text sub imagini', { exact: true }).fill('Primul paragraf.\n\nAl doilea paragraf.');
  await cardForm.getByRole('button', { name: 'Salvează' }).click();
  await expect(page.getByTestId('card-item')).toHaveCount(1);
  await expect(page.getByTestId('card-item')).toContainText('1 imagine');

  // second card, then move it up and delete it
  await page.getByRole('button', { name: 'Adaugă card' }).click();
  await page.getByTestId('card-form').getByRole('textbox', { name: 'Text', exact: true }).fill('Card doi');
  await page.getByTestId('card-form').getByRole('button', { name: 'Salvează' }).click();
  await expect(page.getByTestId('card-item')).toHaveCount(2);
  await page.getByRole('button', { name: 'Mută sus cardul 2' }).click();
  await expect(page.getByTestId('card-item').first()).toContainText('Card doi');
  await page.getByTestId('card-item').first().getByRole('button', { name: 'Șterge' }).click();
  await page.getByRole('button', { name: 'Confirmă ștergerea' }).click();
  await expect(page.getByTestId('card-item')).toHaveCount(1);
  await expect(page.getByTestId('card-item')).toContainText('Unirea');

  // Questions: one of each type
  await page.getByRole('tab', { name: /Întrebări/ }).click();
  const add = async (fill: () => Promise<void>) => {
    await page.getByRole('button', { name: 'Adaugă întrebare' }).click();
    await fill();
    await page.getByTestId('question-form').getByRole('button', { name: 'Salvează' }).click();
  };
  const form = page.getByTestId('question-form');

  await add(async () => {
    await form.getByLabel('Enunț').fill('Când a fost Unirea Principatelor?');
    await form.getByLabel('Varianta 1').fill('1859');
    await form.getByLabel('Varianta 2').fill('1918');
    await form.getByLabel('Corectă 1').check();
  });
  await expect(page.getByTestId('question-item')).toHaveCount(1);

  // invalid: single choice without a correct answer shows the Romanian error and saves nothing
  await page.getByRole('button', { name: 'Adaugă întrebare' }).click();
  await form.getByLabel('Enunț').fill('Invalidă');
  await form.getByLabel('Varianta 1').fill('a');
  await form.getByLabel('Varianta 2').fill('b');
  await form.getByRole('button', { name: 'Salvează' }).click();
  await expect(form.getByText('Alegerea simplă trebuie să aibă exact un răspuns corect.')).toBeVisible();
  await expect(page.getByTestId('question-item')).toHaveCount(1);
  await form.getByRole('button', { name: 'Anulează' }).click();

  await add(async () => {
    await form.getByLabel('Tip').selectOption('multiple_choice');
    await form.getByLabel('Dificultate').selectOption('hard');
    await form.getByLabel('Enunț').fill('Care sunt state istorice românești?');
    await form.getByLabel('Varianta 1').fill('Țara Românească');
    await form.getByLabel('Varianta 2').fill('Moldova');
    await form.getByLabel('Corectă 1').check();
    await form.getByLabel('Corectă 2').check();
  });
  await expect(page.getByTestId('question-item')).toHaveCount(2);

  await add(async () => {
    await form.getByLabel('Tip').selectOption('chronological_order');
    await form.getByLabel('Enunț').fill('Ordonează evenimentele');
    await form.getByLabel('Element 1').fill('Marea Unire');
    await form.getByLabel('An / etichetă 1').fill('1918');
    await form.getByLabel('Element 2').fill('Unirea Principatelor');
    await form.getByLabel('An / etichetă 2').fill('1859');
    await form.getByRole('button', { name: 'Mută sus 2' }).click(); // 1859 first
  });
  await expect(page.getByTestId('question-item')).toHaveCount(3);

  // Exercise
  await page.getByRole('tab', { name: /Exerciții de redactare/ }).click();
  await page.getByRole('button', { name: 'Adaugă exercițiu' }).click();
  await page.getByTestId('exercise-form').getByLabel('Enunț').fill('Prezintă domnia lui Alexandru Ioan Cuza.');
  await page.getByTestId('exercise-form').getByLabel('Criterii de evaluare').fill('Context istoric\nReforme');
  await page.getByTestId('exercise-form').getByRole('button', { name: 'Salvează' }).click();
  await expect(page.getByTestId('exercise-item')).toHaveCount(1);

  // Draft is hidden from students, published is visible
  const fetchPublished = () =>
    student.from('lessons').select('id,title,cards(*),questions(*),writing_exercises(*)').eq('id', lessonId).maybeSingle();
  expect((await fetchPublished()).data).toBeNull();

  await page.getByRole('button', { name: 'Publică' }).click();
  await expect(page.getByTestId('lesson-status')).toHaveText('Publicată');

  const { data } = await fetchPublished();
  expect(data?.title).toBe('[test] lecție completă');
  const anon = createClient(SB_URL, SB_ANON, { auth: { persistSession: false } });
  expect((await anon.from('lessons').select('id').eq('id', lessonId).maybeSingle()).data).toBeNull();
  expect(data?.cards).toHaveLength(1);
  expect(data?.cards[0]).toMatchObject({
    title: 'Unirea',
    type: 'images',
    content: {
      display: 'single',
      text: 'Primul paragraf.\n\nAl doilea paragraf.',
      images: [{ alt: 'Harta Principatelor', credit: 'Wikimedia Commons' }],
    },
  });
  const imagePath: string | null = data?.cards[0].content.images[0].path ?? null;
  expect(imagePath).toMatch(new RegExp(`^lessons/${lessonId}/.+\\.png$`));
  expect((await fetch(`${SB_URL}/storage/v1/object/public/images/${imagePath}`)).status).toBe(200);
  expect(data?.questions.map((q: { type: string }) => q.type).sort()).toEqual(['chronological_order', 'multiple_choice', 'single_choice']);
  const order = data?.questions.find((q: { type: string }) => q.type === 'chronological_order');
  expect(order.options.map((o: { label?: string }) => o.label)).toEqual(['1859', '1918']);
  expect(data?.writing_exercises).toHaveLength(1);

  // Reload: everything persisted
  await page.reload();
  await expect(page.getByTestId('card-item')).toHaveCount(1);
  await page.getByRole('tab', { name: /Întrebări/ }).click();
  await expect(page.getByTestId('question-item')).toHaveCount(3);
});

test('lesson editor: unknown lesson id is a 404', async ({ page }) => {
  await login(page);
  const res = await page.goto('/lessons/00000000-0000-0000-0000-000000000000');
  expect(res?.status()).toBe(404);
});
