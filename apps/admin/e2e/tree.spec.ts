import { expect, test, type Page } from '@playwright/test';

const EMAIL = process.env.ADMIN_EMAIL ?? 'admin@prepio.local';
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'prepio-local-admin';
const THEME = `[test] Temă ${Date.now()}`;

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Parolă').fill(PASSWORD);
  await page.getByRole('button', { name: 'Intră' }).click();
  await expect(page).toHaveURL('http://localhost:3000/');
}

const row = (page: Page, title: string) =>
  page.getByTestId('node-row').filter({ has: page.getByRole('heading', { name: title, exact: true }) }).last();

async function fillDialog(page: Page, title: string, submit: string) {
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Titlu').fill(title);
  await dialog.getByRole('button', { name: submit }).click();
  await expect(dialog).toBeHidden();
}

test('tree: create nodes and a lesson, publish it, rename, confirm-delete with counts', async ({ page }) => {
  await login(page);

  await page.getByRole('button', { name: 'Adaugă temă' }).click();
  await fillDialog(page, THEME, 'Adaugă');
  await expect(page.getByRole('heading', { name: THEME, exact: true })).toBeVisible();

  await row(page, THEME).getByRole('button', { name: 'Adaugă subnod' }).first().click();
  await fillDialog(page, '[test] Capitol', 'Adaugă');
  await expect(page.getByRole('heading', { name: '[test] Capitol' })).toBeVisible();

  await row(page, '[test] Capitol').getByRole('button', { name: 'Adaugă lecție' }).click();
  await fillDialog(page, '[test] Lecție', 'Adaugă');
  const lesson = page.getByTestId('lesson-row').filter({ hasText: '[test] Lecție' });
  await expect(lesson.getByTestId('lesson-status')).toHaveText('Ciornă');

  await lesson.getByRole('button', { name: 'Publică' }).click();
  await expect(lesson.getByTestId('lesson-status')).toHaveText('Publicată');
  // Published: delete is disabled with a visible hint; unpublishing asks first.
  const del = lesson.getByRole('button', { name: 'Șterge lecția' });
  await expect(del).toBeDisabled();
  await expect(lesson.getByText('Depublică lecția întâi')).toBeVisible();
  await lesson.getByRole('button', { name: 'Retrage' }).click();
  const confirm = page.getByRole('dialog');
  await expect(confirm.getByText('Retragi lecția din publicare? Elevii nu o vor mai vedea.')).toBeVisible();
  await confirm.getByRole('button', { name: 'Anulează' }).click();
  await expect(confirm).toBeHidden();
  await expect(lesson.getByTestId('lesson-status')).toHaveText('Publicată');
  await lesson.getByRole('button', { name: 'Retrage' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Retrage' }).click();
  await expect(lesson.getByTestId('lesson-status')).toHaveText('Ciornă');

  await row(page, '[test] Capitol').getByRole('button', { name: 'Redenumește' }).first().click();
  await fillDialog(page, '[test] Capitol 2', 'Salvează');
  await expect(page.getByRole('heading', { name: '[test] Capitol 2' })).toBeVisible();

  // Delete the theme: confirmation states 1 sub-node and 1 lesson.
  await row(page, THEME).getByRole('button', { name: 'Șterge', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByTestId('confirm-text')).toContainText('1 subnod și 1 lecție');
  await dialog.getByRole('button', { name: 'Anulează' }).click();
  await expect(page.getByRole('heading', { name: THEME, exact: true })).toBeVisible();

  await row(page, THEME).getByRole('button', { name: 'Șterge', exact: true }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Șterge' }).click();
  await expect(page.getByRole('heading', { name: THEME, exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '[test] Capitol 2' })).toHaveCount(0);
});
test('tree: no horizontal overflow at 360 px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await login(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
