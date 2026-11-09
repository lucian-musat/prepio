import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

config({ path: [resolve(__dirname, '../.env.local'), resolve(__dirname, '../../../.env')], quiet: true });

const SB_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!;
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const EMAIL = process.env.ADMIN_EMAIL ?? 'admin@prepio.local';
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'prepio-local-admin';
const TITLE = `[test] Subiect ${Date.now()}`;
const TEMPLATE = `[test] bac răspuns scurt ${Date.now()}`;

let service: SupabaseClient;
let templateId: string | null = null;

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Parolă').fill(PASSWORD);
  await page.getByRole('button', { name: 'Intră' }).click();
  await expect(page).toHaveURL('http://localhost:3000/');
}

test.beforeAll(async () => {
  service = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
  const tpl = await service
    .from('solution_templates')
    .insert({ title: TEMPLATE, exercise_type: 'short_answer', points: '', body: 'Citește sursa.' })
    .select('id')
    .single();
  if (tpl.error) throw tpl.error;
  templateId = tpl.data.id;
});

// Removes whatever a failed run left behind; each step runs even if another fails.
test.afterAll(async () => {
  const failures: string[] = [];
  const left = await service.from('bac_subjects').select('id').eq('title', TITLE);
  for (const s of left.data ?? []) {
    const items = await service.from('bac_items').delete().eq('subject_id', s.id); // item sources and barem go with them
    if (items.error) failures.push(`items: ${items.error.message}`);
    const subject = await service.from('bac_subjects').delete().eq('id', s.id);
    if (subject.error) failures.push(`subject: ${subject.error.message}`);
  }
  if (templateId) {
    const t = await service.from('solution_templates').delete().eq('id', templateId);
    if (t.error) failures.push(`template: ${t.error.message}`);
  }
  if (failures.length) throw new Error(`[test] cleanup failed: ${failures.join('; ')}`);
});

test('BAC subject: create, source and item in Subiectul I, live total, publish refused, delete', async ({ page }) => {
  await login(page);
  await page.getByRole('navigation', { name: 'Navigare' }).getByRole('link', { name: 'Subiecte BAC' }).click();
  await expect(page.getByRole('heading', { name: 'Subiecte BAC' })).toBeVisible();

  // Create
  await page.getByRole('button', { name: 'Adaugă subiect' }).click();
  const details = page.getByTestId('bac-details-form');
  await details.getByLabel('Titlu', { exact: true }).fill(TITLE);
  await details.getByLabel('An', { exact: true }).fill('2026');
  await details.getByLabel('Varianta', { exact: true }).fill('Varianta 9');
  await details.getByLabel('Cost (credite)', { exact: true }).fill('10');
  await details.getByRole('button', { name: 'Creează subiectul' }).click();
  await expect(page.getByRole('heading', { name: TITLE })).toBeVisible();
  await expect(page.getByTestId('bac-total')).toHaveText('Total: 0 / 90');
  await expect(page.getByTestId('bac-status')).toHaveText('Ciornă');

  // Subiectul I: source A
  await page.getByRole('tab', { name: 'Subiectul I', exact: true }).click();
  await page.getByRole('button', { name: 'Adaugă sursă' }).click();
  const source = page.getByTestId('source-form');
  await source.getByLabel('Autor', { exact: true }).fill('Istoric');
  await source.getByLabel('Text', { exact: true }).fill('Carol I a devenit domnitor al României în 1866.');
  await source.getByRole('button', { name: 'Salvează sursa' }).click();
  await expect(page.getByTestId('bac-source')).toHaveCount(1);
  await expect(page.getByTestId('bac-source')).toContainText('Sursa A');

  // a „Răspuns scurt” item worth 2 p
  await page.getByRole('button', { name: 'Adaugă cerință' }).click();
  await page.getByRole('radiogroup').getByText('Răspuns scurt', { exact: true }).click();
  const item = page.getByTestId('bac-item-form');
  await item.getByLabel('Enunț', { exact: true }).fill('Numiți domnitorul precizat în sursa A.');
  await item.getByLabel(/^Sursa A · /).check();
  await item.getByLabel('Variante acceptate (una pe rând)', { exact: true }).fill('Carol I');
  await item.getByLabel('Punctaj', { exact: true }).fill('2');
  await item.getByLabel('Cum rezolv', { exact: true }).selectOption({ label: TEMPLATE });
  await item.getByLabel('Barem', { exact: true }).fill('Carol I');
  await item.getByRole('button', { name: 'Salvează' }).click();
  await expect(page.getByTestId('bac-item')).toHaveCount(1);
  await expect(page.getByTestId('bac-item')).toContainText('1. Numiți domnitorul precizat în sursa A.');
  await expect(page.getByTestId('bac-item')).not.toContainText('Invalid');
  await expect(page.getByTestId('bac-total')).toHaveText('Total: 2 / 90');

  // Publishing is refused: total 2 of 90
  await page.getByRole('tab', { name: 'Detalii' }).click();
  await page.getByLabel('Publicat', { exact: true }).click();
  await expect(page.getByText('Subiectul nu poate fi publicat: totalul este 2 din 90.')).toBeVisible();
  await expect(page.getByTestId('bac-status')).toHaveText('Ciornă');
  await expect(page.getByLabel('Publicat', { exact: true })).not.toBeChecked();

  // The list shows it as a draft with its total, then delete it
  await page.getByRole('link', { name: '← Subiecte BAC' }).click();
  const row = page.getByTestId('bac-row').filter({ hasText: TITLE });
  await expect(row).toContainText('2026');
  await expect(row).toContainText('Varianta 9');
  await expect(row).toContainText('2 / 90');
  await expect(row).toContainText('Ciornă');
  await row.getByRole('button', { name: `Șterge ${TITLE}` }).click();
  await row.getByRole('button', { name: 'Confirmă ștergerea' }).click();
  await expect(page.getByTestId('bac-row').filter({ hasText: TITLE })).toHaveCount(0);
});
