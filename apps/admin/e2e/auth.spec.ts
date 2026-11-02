import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

config({ path: [resolve(__dirname, '../.env.local'), resolve(__dirname, '../../../.env')], quiet: true });

const SB_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!;
const SB_ANON = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!;
const SB_SERVICE =process.env.SUPABASE_SERVICE_ROLE_KEY!;
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

test('[test] a student (not in admins) cannot use the admin panel', async ({ page }) => {
  const service = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
  const student = { email: `test-student-${Date.now()}@prepio.local`, password: 'test-student-password' };
  const created = await service.auth.admin.createUser({ ...student, email_confirm: true });
  if (created.error) throw created.error;
  try {
    await page.goto('/login');
    await page.getByLabel('Email').fill(student.email);
    await page.getByLabel('Parolă').fill(student.password);
    await page.getByRole('button', { name: 'Intră' }).click();
    await expect(page.getByText('Contul nu are acces de administrator.')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    // The session was not kept: a plain /login redirect (no session at all, not the not-admin bounce).
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
  } finally {
    await service.auth.admin.deleteUser(created.data.user.id);
  }
});

test('[test] a student session cookie is signed out by the proxy and bounced to /login', async ({ page, context }) => {
  const service = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
  const student = { email: `test-student-${Date.now()}@prepio.local`, password: 'test-student-password' };
  const created = await service.auth.admin.createUser({ ...student, email_confirm: true });
  if (created.error) throw created.error;
  try {
    // Build a real @supabase/ssr session cookie for the student (as if they had signed in elsewhere).
    const jar: { name: string; value: string }[] = [];
    const ssr = createServerClient(SB_URL, SB_ANON, {
      cookies: {
        getAll: () => jar,
        setAll: (cookies) => cookies.forEach(({ name, value }) => jar.push({ name, value })),
      },
    });
    const signIn = await ssr.auth.signInWithPassword(student);
    if (signIn.error) throw signIn.error;
    expect(jar.length).toBeGreaterThan(0);
    await context.addCookies(jar.map(({ name, value }) => ({ name, value, url: 'http://localhost:3000' })));

    await page.goto('/');
    await expect(page).toHaveURL(/\/login\?error=not_admin$/);
    await expect(page.getByText('Contul nu are acces de administrator.')).toBeVisible();
    // The proxy cleared the auth cookies on the redirect.
    const left = (await context.cookies()).filter((c) => jar.some((j) => j.name === c.name) && c.value);
    expect(left).toEqual([]);
  } finally {
    await service.auth.admin.deleteUser(created.data.user.id);
  }
});

test('/login?error=not_admin shows the not-admin message', async ({ page }) => {
  await page.goto('/login?error=not_admin');
  await expect(page.getByText('Contul nu are acces de administrator.')).toBeVisible();
});
