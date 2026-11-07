import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { UserError } from '@/lib/data/db';
import { deleteAccount } from './deleteAccount';

config({ path: [resolve(__dirname, '../../../.env.local'), resolve(__dirname, '../../../../../.env')], quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@prepio.local';
const adminPassword = process.env.ADMIN_PASSWORD ?? 'prepio-local-admin';

describe.skipIf(!url || !service)('deleteAccount (local Supabase)', () => {
  let db: SupabaseClient;

  beforeAll(() => {
    db = createClient(url!, service!, { auth: { persistSession: false } });
  });

  function newEmail(kind: string): string {
    return `test-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@prepio.local`;
  }

  async function createUser(kind: string, email = newEmail(kind)): Promise<string> {
    const { data, error } = await db.auth.admin.createUser({ email, password: 'test-password-123', email_confirm: true });
    if (error) throw error;
    return data.user.id;
  }

  async function suspend(id: string, reason: string) {
    const { error } = await db.from('profiles').update({ suspended_at: new Date().toISOString(), suspended_reason: reason }).eq('id', id);
    if (error) throw error;
  }

  async function suspension(id: string) {
    const { data, error } = await db
      .from('profiles')
      .select('suspended_at,suspended_reason,reregistration_blocked')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as { suspended_at: string | null; suspended_reason: string | null; reregistration_blocked: boolean };
  }

  // Accounts re-created with the same email. The local admin reactivates them (which removes the blocked fingerprint),
  // then they are deleted, so no test fingerprint is left behind.
  const reSignedUp: string[] = [];
  afterAll(async () => {
    if (reSignedUp.length === 0) return;
    const admin = createClient(url!, anon!, { auth: { persistSession: false } });
    const failures: string[] = [];
    const signIn = await admin.auth.signInWithPassword({ email: adminEmail, password: adminPassword });
    if (signIn.error) failures.push(`admin sign-in: ${signIn.error.message}`);
    for (const id of reSignedUp) {
      try {
        if (!signIn.error) {
          const r = await admin.rpc('admin_reactivate_student', { p_user: id });
          if (r.error) throw r.error;
        }
      } catch (e) {
        failures.push(`reactivate ${id}: ${e instanceof Error ? e.message : String(e)}`);
      }
      try {
        const d = await db.auth.admin.deleteUser(id);
        if (d.error && d.error.status !== 404) throw d.error;
      } catch (e) {
        failures.push(`delete ${id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (failures.length) throw new Error(`cleanup failed: ${failures.join('; ')}`);
  });

  /** Deletes the account, signs up again with the same email and returns the new account's suspension state. */
  async function deleteAndSignUpAgain(email: string, id: string, opts?: { blockReason?: string }) {
    expect(await deleteAccount(id, db, opts)).toBe('deleted');
    expect((await db.auth.admin.getUserById(id)).data.user).toBeNull();
    const again = await createUser('again', email);
    reSignedUp.push(again);
    return suspension(again);
  }

  it('deletes a student: auth user and profile are gone', async () => {
    const id = await createUser('student');
    try {
      const before = await db.from('profiles').select('id').eq('id', id);
      expect(before.data).toHaveLength(1);

      expect(await deleteAccount(id, db)).toBe('deleted');

      const user = await db.auth.admin.getUserById(id);
      expect(user.data.user).toBeNull();
      const after = await db.from('profiles').select('id').eq('id', id);
      expect(after.error).toBeNull();
      expect(after.data).toHaveLength(0);
    } finally {
      await db.auth.admin.deleteUser(id).catch(() => {});
    }
  });

  it('refuses to delete an admin, who still exists afterwards', async () => {
    const id = await createUser('admin');
    try {
      const ins = await db.from('admins').insert({ user_id: id });
      expect(ins.error).toBeNull();

      expect(await deleteAccount(id, db)).toBe('forbidden_admin');
      expect(await deleteAccount(id, db, { blockReason: '[test] X' })).toBe('forbidden_admin');

      const user = await db.auth.admin.getUserById(id);
      expect(user.data.user?.id).toBe(id);
    } finally {
      await db.auth.admin.deleteUser(id);
    }
  });

  it('a blank blockReason is a UserError and nothing is deleted', async () => {
    const id = await createUser('blank');
    try {
      for (const blockReason of ['', '   ']) {
        await expect(deleteAccount(id, db, { blockReason })).rejects.toThrow(new UserError('Motivul este obligatoriu.'));
      }
      expect((await db.auth.admin.getUserById(id)).data.user?.id).toBe(id);
    } finally {
      await db.auth.admin.deleteUser(id).catch(() => {});
    }
  });

  describe.skipIf(!anon)('blocked re-registration', () => {
    it('a suspended student deleted without opts: the same email signs up suspended with the old reason', async () => {
      const email = newEmail('suspended');
      const id = await createUser('suspended', email);
      await suspend(id, '[test] Spam');

      const again = await deleteAndSignUpAgain(email, id);
      expect(again.suspended_at).not.toBeNull();
      expect(again.suspended_reason).toBe('[test] Spam');
      expect(again.reregistration_blocked).toBe(true);
    });

    it('a suspended student deleted with a blockReason is blocked with that reason', async () => {
      const email = newEmail('suspended-reason');
      const id = await createUser('suspended-reason', email);
      await suspend(id, '[test] Old');

      const again = await deleteAndSignUpAgain(email, id, { blockReason: '[test] New' });
      expect(again.suspended_reason).toBe('[test] New');
      expect(again.reregistration_blocked).toBe(true);
    });

    it('an active student deleted with blockReason: the same email signs up suspended with that reason', async () => {
      const email = newEmail('blocked');
      const id = await createUser('blocked', email);

      const again = await deleteAndSignUpAgain(email, id, { blockReason: '[test] X' });
      expect(again.suspended_at).not.toBeNull();
      expect(again.suspended_reason).toBe('[test] X');
      expect(again.reregistration_blocked).toBe(true);
    });

    it('an active student deleted without opts: the same email signs up active', async () => {
      const email = newEmail('active');
      const id = await createUser('active', email);

      const again = await deleteAndSignUpAgain(email, id);
      expect(again).toEqual({ suspended_at: null, suspended_reason: null, reregistration_blocked: false });
    });
  });
});
