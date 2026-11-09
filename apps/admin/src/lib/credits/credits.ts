import type { SupabaseClient } from '@supabase/supabase-js';

export type Credits = {
  /** Debits `amount`; `entryId` null (and nothing debited) when the balance is too low. */
  spend(userId: string, amount: number, exerciseId: string | null, target: string): Promise<{ entryId: number | null; balance: number }>;
  /** Puts a check's credits back (idempotent); returns the new balance. */
  refund(entryId: number): Promise<number>;
};

/** Wraps the service-role `spend_credits` / `refund_credits` RPCs; throws on RPC errors. */
export function createCredits(db: SupabaseClient): Credits {
  return {
    async spend(userId, amount, exerciseId, target) {
      const { data, error } = await db.rpc('spend_credits', {
        p_user: userId,
        p_amount: amount,
        p_exercise: exerciseId,
        p_target: target,
      });
      if (error) throw new Error(`spend_credits failed: ${error.message}`);
      // `returns table(...)` comes back as an array of rows.
      const row = (Array.isArray(data) ? data[0] : data) as { entry_id: number | string | null; balance: number } | undefined;
      if (!row || typeof row.balance !== 'number') throw new Error('spend_credits failed: no row');
      return { entryId: row.entry_id === null ? null : Number(row.entry_id), balance: row.balance };
    },
    async refund(entryId) {
      const { data, error } = await db.rpc('refund_credits', { p_entry: entryId });
      if (error) throw new Error(`refund_credits failed: ${error.message}`);
      if (typeof data !== 'number') throw new Error('refund_credits failed: no balance');
      return data;
    },
  };
}
