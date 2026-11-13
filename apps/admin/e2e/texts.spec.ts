import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

config({ path: [resolve(__dirname, '../.env.local'), resolve(__dirname, '../../../.env')], quiet: true });

const SB_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!;
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const EMAIL = process.env.ADMIN_EMAIL ?? 'admin@prepio.local';
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'prepio-local-admin';

const KEY = 'home.hero.welcome';

test.afterAll(async () => {
  const service = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
  await service.from('ui_texts').delete().eq('key', KEY);
});

test('edit a text, see it marked modified, reset it', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Parolă').fill(PASSWORD);
  await page.getByRole('button', { name: 'Intră' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));

  await page.getByRole('link', { name: 'Texte' }).click();
  await expect(page.getByRole('heading', { name: 'Texte', level: 1 })).toBeVisible();

  const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: KEY, exact: true }) });
  await row.getByRole('button', { name: 'Editează' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Text').fill('[test] salut');
  await dialog.getByRole('button', { name: 'Salvează' }).click();
  await expect(dialog).toBeHidden();

  await expect(row.getByText('modificat')).toBeVisible();
  await expect(row).toContainText('[test] salut');

  await row.getByRole('button', { name: 'Revino la implicit' }).click();
  await expect(row.getByText('modificat')).toHaveCount(0);
});
