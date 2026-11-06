import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { UserError } from './db';
import {
  adjustCredits, deleteStudent, getStudent, getStudentEvents, getStudentProgress, listStudents, orderStatusLabel,
  reactivateStudent, resetProgress, suspendStudent,
} from './students';
import { getTree, type TreeNode } from './tree';

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

describe.skipIf(!url || !anon || !serviceKey)('student administration data functions (local Supabase)', () => {
  let db: SupabaseClient;
  let service: SupabaseClient;
  const ids: string[] = [];
  const tag = Math.random().toString(36).slice(2, 10);
  const mk = async (name: string) => {
    const e = `test-adm-${name}-${tag}@test.local`;
    const created = await service.auth.admin.createUser({ email: e, email_confirm: true });
    if (created.error) throw created.error;
    ids.push(created.data.user.id);
    return { id: created.data.user.id, email: e };
  };
  const flatten = (nodes: TreeNode[], out: string[] = []) => {
    for (const n of nodes) {
      out.push(...n.lessons.filter((l) => l.status === 'published').map((l) => l.id));
      flatten(n.children, out);
    }
    return out;
  };

  beforeAll(async () => {
    db = createClient(url!, anon!, { auth: { persistSession: false } });
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    service = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
  });

  afterAll(async () => {
    for (const id of ids) await service.auth.admin.deleteUser(id);
    await service.from('blocked_emails').delete().like('reason', '[test]%');
  });

  it('filters the list: suspended and active today', async () => {
    const a = await mk('filter');
    const search = `test-adm-filter-${tag}`;
    expect((await listStudents(db, { search, page: 1, filter: 'suspended' })).total).toBe(0);
    const active = await listStudents(db, { search, page: 1, filter: 'active_today' });
    expect(active.rows.map((r) => r.id)).toEqual([a.id]);
    expect(active.rows[0]).toMatchObject({ suspendedAt: null, reregistrationBlocked: false, lessonsFinished: 0 });
    expect(active.rows[0].lastActivityAt).not.toBeNull();
    await suspendStudent(db, a.id, '[test] spam');
    const sus = await listStudents(db, { search, page: 1, filter: 'suspended' });
    expect(sus.rows[0]).toMatchObject({ id: a.id, suspendedReason: '[test] spam' });
    expect((await listStudents(db, { search, page: 1 })).total).toBe(1);
    await reactivateStudent(db, a.id);
    expect((await listStudents(db, { search, page: 1, filter: 'suspended' })).total).toBe(0);
  });

  it('suspend needs a reason, and logs events with the admin', async () => {
    const a = await mk('susp');
    await expect(suspendStudent(db, a.id, '  ')).rejects.toThrow(new UserError('Motivul este obligatoriu.'));
    await suspendStudent(db, a.id, '[test] abuz');
    await reactivateStudent(db, a.id);
    const events = await getStudentEvents(db, a.id);
    expect(events[0].label).toBe(`${email}: cont reactivat`);
    expect(events[1].label).toBe(`${email}: cont suspendat · „[test] abuz”`);
  });

  it('refuses to act on an admin', async () => {
    const adminId = (await db.auth.getUser()).data.user!.id;
    await expect(suspendStudent(db, adminId, 'x')).rejects.toThrow(
      new UserError('Conturile de administrator nu pot fi modificate aici.'),
    );
  });

  it('progress lists published lessons in tree order with statuses; reset one and all', async () => {
    const a = await mk('prog');
    const lessons = flatten(await getTree(db));
    expect(lessons.length).toBeGreaterThanOrEqual(2);
    const [l1, l2] = lessons;
    const p1 = await service.from('lesson_progress').insert({ user_id: a.id, lesson_id: l1, position: { phase: 'cards', index: 0, results: {} } });
    if (p1.error) throw p1.error;
    const p2 = await service.from('lesson_progress').insert({ user_id: a.id, lesson_id: l2, finished_at: new Date().toISOString() });
    if (p2.error) throw p2.error;
    const rows = await getStudentProgress(db, a.id);
    expect(rows.map((r) => r.lessonId)).toEqual(lessons);
    expect(rows[0]).toMatchObject({ status: 'in_progress' });
    expect(rows[0].where).toMatch(/^Card 1 din \d+$/);
    expect(rows[1]).toMatchObject({ status: 'finished', where: 'Terminată' });
    if (rows.length > 2) expect(rows[2]).toMatchObject({ status: 'not_started', where: '—', lastActivityAt: null });

    await resetProgress(db, a.id, l1);
    let after = await getStudentProgress(db, a.id);
    expect(after[0].status).toBe('not_started');
    expect(after[1].status).toBe('finished');
    await resetProgress(db, a.id, null);
    after = await getStudentProgress(db, a.id);
    expect(after.every((r) => r.status === 'not_started')).toBe(true);
    const events = await getStudentEvents(db, a.id);
    expect(events[0].label).toBe(`${email}: parcurs resetat · toate lecțiile`);
    expect(events[1].label).toMatch(new RegExp(`^${email}: parcurs resetat · lecția „.+”$`));
  });

  it('paginates events with before', async () => {
    const a = await mk('page');
    for (let i = 0; i < 52; i++) {
      const r = await service.rpc('log_student_event_service', {
        p_user: a.id, p_kind: 'check_blocked', p_exercise: null, p_details: { required: 2, balance: 0 },
      });
      if (r.error) throw r.error;
    }
    const first = await getStudentEvents(db, a.id);
    expect(first).toHaveLength(50);
    const second = await getStudentEvents(db, a.id, first[49].id);
    expect(second.length).toBeGreaterThanOrEqual(3);
    expect(new Set([...first, ...second].map((e) => e.id)).size).toBe(first.length + second.length);
    expect(second[0].id).toBeLessThan(first[49].id);
  });

  it('deleteStudent: email mismatch, block needs a reason, delete without and with block', async () => {
    const a = await mk('del1');
    await expect(deleteStudent(service, a.id, { confirmEmail: 'other@x.ro', block: false, reason: '' })).rejects.toThrow(
      new UserError('Emailul nu se potrivește.'),
    );
    await expect(deleteStudent(service, a.id, { confirmEmail: a.email, block: true, reason: ' ' })).rejects.toThrow(
      new UserError('Motivul este obligatoriu.'),
    );
    expect((await service.auth.admin.getUserById(a.id)).data.user).not.toBeNull();
    await deleteStudent(service, a.id, { confirmEmail: `  ${a.email.toUpperCase()} `, block: false, reason: '' });
    expect((await service.auth.admin.getUserById(a.id)).data.user).toBeNull();

    const b = await mk('del2');
    await deleteStudent(service, b.id, { confirmEmail: b.email, block: true, reason: '[test] blocat' });
    const again = await service.auth.admin.createUser({ email: b.email, email_confirm: true });
    if (again.error) throw again.error;
    ids.push(again.data.user.id);
    const prof = await service.from('profiles').select('suspended_at,suspended_reason,reregistration_blocked').eq('id', again.data.user.id).single();
    expect(prof.data).toMatchObject({ suspended_reason: '[test] blocat', reregistration_blocked: true });
  });
});
