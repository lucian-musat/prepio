import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import { deleteAccount } from './deleteAccount';

config({ path: [resolve(__dirname, '../../../.env.local'), resolve(__dirname, '../../../../../.env')], quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!url || !service)('deleteAccount (local Supabase)', () => {
  let db: SupabaseClient;

  beforeAll(() => {
    db = createClient(url!, service!, { auth: { persistSession: false } });
  });

  async function createUser(kind: string): Promise<string> {
    const email = `test-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@prepio.local`;
    const { data, error } = await db.auth.admin.createUser({ email, password: 'test-password-123', email_confirm: true });
    if (error) throw error;
    return data.user.id;
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

      const user = await db.auth.admin.getUserById(id);
      expect(user.data.user?.id).toBe(id);
    } finally {
      await db.auth.admin.deleteUser(id);
    }
  });
});
