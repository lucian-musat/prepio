import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

config({ path: [resolve(__dirname, '../.env.local'), resolve(__dirname, '../../../.env')], quiet: true });

const SB_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!;
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SB_ANON = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!;
const EMAIL = process.env.ADMIN_EMAIL ?? 'admin@prepio.local';
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'prepio-local-admin';

test.describe.configure({ mode: 'serial' });

let service: SupabaseClient;
/** Every auth user this file created; deleted in afterAll (already-deleted ids are ignored). */
const created: string[] = [];
const testEmail = `test-elevi-${Math.random().toString(36).slice(2, 10)}@test.local`;

async function createStudent(email: string): Promise<string> {
  const res = await service.auth.admin.createUser({ email, email_confirm: true });
  if (res.error) throw res.error;
  created.push(res.data.user.id);
  return res.data.user.id;
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Parolă').fill(PASSWORD);
  await page.getByRole('button', { name: 'Intră' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

test.beforeAll(async () => {
  service = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
});

test.afterAll(async () => {
  // If a run stopped between "delete with block" and the reactivation, the email fingerprint is still stored (only the
  // admin reactivation removes it): reactivate any blocked account first, then delete everything this file created.
  const blocked = await service.from('profiles').select('id').in('id', created).eq('reregistration_blocked', true);
  if (blocked.data?.length) {
    const admin = createClient(SB_URL, SB_ANON, { auth: { persistSession: false } });
    await admin.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
    for (const { id } of blocked.data) await admin.rpc('admin_reactivate_student', { p_user: id });
  }
  for (const id of created) await service.auth.admin.deleteUser(id);
});

test('search a student and adjust credits', async ({ page }) => {
  await createStudent(testEmail);
  await login(page);

  await page.getByRole('link', { name: 'Elevi' }).click();
  await page.getByLabel('Caută elev').fill(testEmail);
  await page.getByRole('button', { name: 'Caută' }).click();
  await expect(page.getByRole('cell', { name: testEmail })).toBeVisible();
  await page.getByRole('link', { name: '—' }).click();
  await expect(page.getByTestId('balance')).toHaveText('12');

  await page.getByRole('button', { name: 'Ajustează credite' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Credite (±)').fill('-2');
  await dialog.getByLabel('Motiv').fill('[test] corecție');
  await dialog.getByRole('button', { name: 'Continuă' }).click();
  await dialog.getByRole('button', { name: 'Aplică' }).click();
  await expect(dialog.getByRole('status')).toHaveText('Ajustat. Sold nou: 10.');
  await dialog.getByRole('button', { name: 'Închide' }).click();

  await expect(page.getByTestId('balance')).toHaveText('10');
  await page.getByRole('link', { name: 'Credite', exact: true }).click();
  const row = page.getByRole('row', { name: /Ajustare admin/ });
  await expect(row).toContainText('[test] corecție');
  await expect(row).toContainText('-2');
});

test('reset progress, suspend, reactivate, delete with block', async ({ page }) => {
  const email = `test-elevi-${Math.random().toString(36).slice(2, 10)}@test.local`;
  const id = await createStudent(email);
  const lesson = await service.from('lessons').select('id,title').eq('status', 'published').limit(1).single();
  if (lesson.error) throw lesson.error;
  const prog = await service
    .from('lesson_progress')
    .insert({ user_id: id, lesson_id: lesson.data.id, position: { phase: 'cards', index: 0, results: {} } });
  if (prog.error) throw prog.error;

  await login(page);
  await page.goto(`/students/${id}`);

  // Reset one lesson.
  const lessonRow = page.getByRole('row', { name: new RegExp(lesson.data.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) });
  await expect(lessonRow).toContainText('În curs');
  await lessonRow.getByRole('button', { name: 'Resetează', exact: true }).click();
  const resetDialog = page.getByRole('dialog');
  await expect(resetDialog).toContainText(`Resetezi lecția „${lesson.data.title}”?`);
  await resetDialog.getByRole('button', { name: 'Resetează', exact: true }).click();
  await expect(resetDialog).toBeHidden();
  await expect(lessonRow).toContainText('Neîncepută');
  await page.getByRole('link', { name: 'Cronologie' }).click();
  await expect(page.getByText(/parcurs resetat/)).toBeVisible();

  // Suspend.
  await page.getByRole('button', { name: 'Suspendă' }).click();
  const suspend = page.getByRole('dialog');
  await suspend.getByLabel('Motiv (îl vede elevul)').fill('[test] Spam');
  await suspend.getByRole('button', { name: 'Suspendă' }).click();
  await expect(suspend).toBeHidden();
  await expect(page.getByTestId('status')).toHaveText('Suspendat');
  await expect(page.getByTestId('suspension')).toHaveText(/^Suspendat de admin@prepio\.local pe .* · Motiv: „\[test\] Spam”$/);

  // Reactivate.
  await page.getByRole('button', { name: 'Reactivează' }).click();
  const reactivate = page.getByRole('dialog');
  await expect(reactivate).toContainText('Reactivezi contul? Elevul își recapătă accesul imediat.');
  await reactivate.getByRole('button', { name: 'Reactivează' }).click();
  await expect(reactivate).toBeHidden();
  await expect(page.getByTestId('status')).toHaveText('Activ');
  await expect(page.getByTestId('suspension')).toHaveCount(0);

  // Delete with block.
  await page.getByRole('button', { name: 'Șterge contul' }).click();
  const del = page.getByRole('dialog');
  await del.getByLabel('Blochează reînregistrarea cu acest email').check();
  await del.getByLabel('Motiv (îl vede elevul dacă revine)').fill('[test] blocat');
  const confirm = del.getByRole('button', { name: 'Șterge definitiv' });
  await expect(confirm).toBeDisabled();
  await del.getByLabel('Scrie emailul elevului ca să confirmi').fill(email);
  await confirm.click();
  await page.waitForURL(/\/students\?notice=deleted/);
  await expect(page.getByText('Contul a fost șters.')).toBeVisible();

  // Signing up again with the same email: the account is created suspended and blocked.
  const again = await createStudent(email);
  await page.getByLabel('Caută elev').fill(email);
  await page.getByRole('button', { name: 'Caută' }).click();
  const listRow = page.getByRole('row', { name: new RegExp(email.replace(/[.]/g, '\\.')) });
  await expect(listRow).toContainText('Suspendat');
  await expect(listRow).toContainText('Reînregistrare blocată');

  await page.goto(`/students/${again}`);
  await expect(page.getByTestId('suspension')).toHaveText(/^Suspendat de sistem pe .* · Motiv: „\[test\] blocat”$/);

  // Clean up: reactivating removes the email block; afterAll deletes the account.
  await page.getByRole('button', { name: 'Reactivează' }).click();
  const unblock = page.getByRole('dialog');
  await expect(unblock).toContainText('Emailul nu va mai fi blocat la reînregistrare.');
  await unblock.getByRole('button', { name: 'Reactivează' }).click();
  await expect(page.getByTestId('status')).toHaveText('Activ');
  const blocked = await service.from('profiles').select('reregistration_blocked').eq('id', again).single();
  expect(blocked.data?.reregistration_blocked).toBe(false);
});

test('grant and revoke access, plan, orders and the Acces complet filter', async ({ page }) => {
  const email = `test-elevi-${Math.random().toString(36).slice(2, 10)}@test.local`;
  const id = await createStudent(email);
  await login(page);
  await page.goto(`/students/${id}`);
  await expect(page.getByTestId('plan')).toHaveText('Trial');
  await expect(page.getByRole('button', { name: 'Retrage accesul' })).toHaveCount(0);

  const inFilter = async (filter: 'trial' | 'full') => {
    await page.goto(`/students?${new URLSearchParams({ q: email, filter })}`);
    await expect(page.getByRole('link', { name: filter === 'full' ? 'Acces complet' : 'Trial', exact: true })).toHaveAttribute('aria-current', 'true');
    return page.getByRole('cell', { name: email });
  };

  // Grant: needs a reason and 1-24 months.
  await page.getByRole('button', { name: 'Acordă acces' }).click();
  const grant = page.getByRole('dialog');
  await expect(grant).toContainText('Lunile se adaugă la accesul curent. Nu se adaugă credite.');
  await grant.getByLabel('Număr de luni').fill('30');
  await grant.getByLabel('Motiv').fill('[test] cadou');
  await grant.getByRole('button', { name: 'Acordă acces' }).click();
  await expect(grant).toContainText('Alege între 1 și 24 de luni.');
  await grant.getByLabel('Număr de luni').fill('2');
  await grant.getByRole('button', { name: 'Acordă acces' }).click();
  await expect(grant).toBeHidden();
  await expect(page.getByRole('status')).toContainText(/^Acces acordat până la \d{1,2} \p{L}+ \d{4}\.$/u);
  await expect(page.getByTestId('plan')).toHaveText(/^Acces până la /);
  await expect(page.getByTestId('balance')).toHaveText('12'); // no credits added

  await page.getByRole('link', { name: 'Cronologie' }).click();
  await expect(page.getByText(/acces acordat · 2 luni · Motiv: „\[test\] cadou”/)).toBeVisible();

  await expect(await inFilter('full')).toBeVisible();
  await expect(await inFilter('trial')).toHaveCount(0);

  // Revoke.
  await page.goto(`/students/${id}`);
  await page.getByRole('button', { name: 'Retrage accesul' }).click();
  const revoke = page.getByRole('dialog');
  await expect(revoke).toContainText('Elevul revine la trial acum. Creditele rămân.');
  await revoke.getByRole('button', { name: 'Retrage accesul' }).click();
  await expect(revoke).toContainText('Scrie motivul.');
  await revoke.getByLabel('Motiv').fill('[test] retras');
  await revoke.getByRole('button', { name: 'Retrage accesul' }).click();
  await expect(revoke).toBeHidden();
  await expect(page.getByRole('status')).toHaveText(/Accesul a fost retras\./);
  await expect(page.getByTestId('plan')).toHaveText(/^Expirat pe \d{1,2} \p{L}+ \d{4}$/u);
  await expect(page.getByRole('button', { name: 'Retrage accesul' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Cronologie' }).click();
  await expect(page.getByText(/acces retras · Motiv: „\[test\] retras”/)).toBeVisible();

  await expect(await inFilter('trial')).toBeVisible();
  await expect(await inFilter('full')).toHaveCount(0);
});

test('Comenzi lists access orders with credit orders, newest first', async ({ page }) => {
  const email = `test-elevi-${Math.random().toString(36).slice(2, 10)}@test.local`;
  const id = await createStudent(email);
  const settings = await service.from('access_settings').select('price_bani,bonus_credits,duration_months').single();
  if (settings.error) throw settings.error;
  const { price_bani, bonus_credits, duration_months } = settings.data;
  const bought = await service.rpc('purchase_access', {
    p_user: id, p_price_bani: price_bani, p_bonus: bonus_credits, p_months: duration_months,
  });
  if (bought.error) throw bought.error;

  await login(page);
  await page.goto(`/students/${id}?tab=comenzi`);
  const row = page.getByRole('row', { name: /^.*Acces \d+ luni/ });
  await expect(row).toContainText(`Acces ${duration_months} luni · +${bonus_credits} credite`);
  await expect(row).toContainText(`${(price_bani / 100).toFixed(2).replace('.', ',')} lei`);
  await expect(row).toContainText('Aprobată (fără plată)');

  await page.goto(`/students/${id}?tab=credite`);
  await expect(page.getByRole('row', { name: /Credite incluse în acces/ })).toContainText(`+${bonus_credits}`);
  await page.goto(`/students/${id}?tab=cronologie`);
  await expect(page.getByText(/Acces cumpărat · \d+ luni · /)).toBeVisible();
});
