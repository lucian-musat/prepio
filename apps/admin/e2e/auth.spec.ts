import { expect, test } from '@playwright/test';

const EMAIL = process.env.ADMIN_EMAIL ?? 'admin@prepio.local';
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'prepio-local-admin';

test('unauthenticated visit redirects to /login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
});

test('wrong password shows an error', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Parolă').fill('parola-gresita');
  await page.getByRole('button', { name: 'Intră' }).click();
  await expect(page.getByText('Email sau parolă greșită')).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test('login lands on / and logout returns to /login', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Parolă').fill(PASSWORD);
  await page.getByRole('button', { name: 'Intră' }).click();
  await expect(page).toHaveURL('http://localhost:3000/');
  await expect(page.getByRole('link', { name: 'Conținut' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Setări' })).toBeVisible();

  await page.getByRole('button', { name: 'Ieșire' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
});
