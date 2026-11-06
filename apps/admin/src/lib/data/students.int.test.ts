import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { UserError } from './db';
import { adjustCredits, getStudent, listStudents, orderStatusLabel } from './students';

config({ path: [resolve(__dirname, '../../../.env.local'), resolve(__dirname, '../../../../../.env')], quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ADMIN_EMAIL ?? 'admin@prepio.local';
const password = process.env.ADMIN_PASSWORD ?? 'prepio-local-admin';

describe.skipIf(!url || !anon || !serviceKey)('students data functions (local Supabase)', () => {
  let db: SupabaseClient;
  let service: SupabaseClient;
  let userId: string | undefined;
  const testEmail = `test-elevi-${Math.random().toString(36).slice(2, 10)}@test.local`;

  beforeAll(async () => {
    db = createClient(url!, anon!, { auth: { persistSession: false } });
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    service = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    const created = await service.auth.admin.createUser({ email: testEmail, email_confirm: true });
    if (created.error) throw created.error;
    userId = created.data.user.id;
  });

  afterAll(async () => {
    if (userId) await service.auth.admin.deleteUser(userId);
  });

  it('finds the student by part of the email with the welcome balance', async () => {
    const { rows, total } = await listStudents(db, { search: testEmail.slice(0, 20), page: 1 });
    expect(total).toBe(1);
    expect(rows[0]).toMatchObject({ id: userId, email: testEmail, creditBalance: 12 });
  });

  it('adjusts credits and records an admin ledger row', async () => {
    await adjustCredits(db, userId!, 5, '[test] bonus');
    const got = await getStudent(db, userId!);
    expect(got!.student.creditBalance).toBe(17);
    expect(got!.ledger[0]).toMatchObject({ kind: 'admin', delta: 5, balanceAfter: 17, reason: '[test] bonus', adminEmail: email });
    expect(got!.orders).toEqual([]);
  });

  it('maps RPC errors to Romanian messages', async () => {
    await expect(adjustCredits(db, userId!, 1, '  ')).rejects.toThrow(new UserError('Motivul este obligatoriu.'));
    await expect(adjustCredits(db, userId!, -100, 'x')).rejects.toThrow(new UserError('Soldul nu poate deveni negativ.'));
    await expect(adjustCredits(db, userId!, 0, 'x')).rejects.toThrow(new UserError('Introdu un număr diferit de 0.'));
    expect((await getStudent(db, userId!))!.student.creditBalance).toBe(17);
  });

  it('a purchase approved without payment lists its provider and is not shown as paid', async () => {
    const pkg = await service.from('credit_packages').select('id').eq('active', true).limit(1).single();
    if (pkg.error) throw pkg.error;
    const bought = await service.rpc('purchase_credit_package', { p_user: userId!, p_package: pkg.data.id });
    if (bought.error) throw bought.error;
    const { orders } = (await getStudent(db, userId!))!;
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ status: 'approved', provider: 'none' });
    expect(orderStatusLabel(orders[0])).toBe('Aprobată (fără plată)');
  });

  it('returns null for an unknown student', async () => {
    expect(await getStudent(db, '00000000-0000-0000-0000-000000000000')).toBeNull();
  });
});
