import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Charges a paper and stores the ledger entry on its attempt in one transaction (`bac_charge_attempt`). `entryId` is
 * null (and nothing is charged) when the balance is too low. Throws on RPC errors, including when the attempt is not
 * the user's or no longer `grading`; after a throw the outcome is unknown, so the caller re-reads the attempt.
 */
export type BacCharge = (
  attemptId: string,
  userId: string,
  amount: number,
  target: string,
) => Promise<{ entryId: number | null; balance: number }>;

export function createBacCharge(db: SupabaseClient): BacCharge {
  return async (attemptId, userId, amount, target) => {
    const { data, error } = await db.rpc('bac_charge_attempt', {
      p_attempt: attemptId,
      p_user: userId,
      p_amount: amount,
      p_target: target,
    });
    if (error) throw new Error(`bac_charge_attempt failed: ${error.message}`);
    // `returns table(...)` comes back as an array of rows.
    const row = (Array.isArray(data) ? data[0] : data) as { entry_id: number | string | null; balance: number } | undefined;
    if (!row || typeof row.balance !== 'number') throw new Error('bac_charge_attempt failed: no row');
    return { entryId: row.entry_id === null ? null : Number(row.entry_id), balance: row.balance };
  };
}
