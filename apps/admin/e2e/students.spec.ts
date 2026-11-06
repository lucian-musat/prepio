import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

config({ path: [resolve(__dirname, '../.env.local'), resolve(__dirname, '../../../.env')], quiet: true });

const SB_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!;
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const EMAIL = process.env.ADMIN_EMAIL ?? 'admin@prepio.local';
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'prepio-local-admin';

let service: SupabaseClient;
let userId: string | undefined;
const testEmail = `test-elevi-${Math.random().toString(36).slice(2, 10)}@test.local`;

test.beforeAll(async () => {
  service = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
  const created = await service.auth.admin.createUser({ email: testEmail, email_confirm: true });
  if (created.error) throw created.error;
  userId = created.data.user.id;
});

test.afterAll(async () => {
  if (userId) await service.auth.admin.deleteUser(userId);
});

test('search a student and adjust credits', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Parolă').fill(PASSWORD);
  await page.getByRole('button', { name: 'Intră' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));

  await page.getByRole('link', { name: 'Elevi' }).click();
  await page.getByLabel('Caută elev').fill(testEmail);
  await page.getByRole('button', { name: 'Caută' }).click();
  await expect(page.getByRole('cell', { name: testEmail })).toBeVisible();
  await page.getByRole('link', { name: '—' }).click();
  await expect(page.getByTestId('balance')).toHaveText('12');

  await page.getByLabel('Credite (±)').fill('-2');
  await page.getByLabel('Motiv').fill('[test] corecție');
  await page.getByRole('button', { name: 'Continuă' }).click();
  await page.getByRole('button', { name: 'Aplică' }).click();

  await expect(page.getByTestId('balance')).toHaveText('10');
  const row = page.getByRole('row', { name: /Ajustare admin/ });
  await expect(row).toContainText('[test] corecție');
  await expect(row).toContainText('-2');
});
