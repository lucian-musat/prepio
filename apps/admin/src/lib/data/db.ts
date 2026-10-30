import type { SupabaseClient } from '@supabase/supabase-js';

export type Direction = 'up' | 'down';

/** Error whose message is a Romanian text that is safe to show to the owner. */
export class UserError extends Error {}

export const GENERIC_ERROR = 'Operația a eșuat. Încearcă din nou.';

export function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) {
    console.error('[data] database error:', res.error);
    throw new UserError(GENERIC_ERROR);
  }
  return res.data;
}

/** For update/delete: RLS denials return no error but also no rows, so zero affected rows is a failure. */
export function checkAffected(res: { data: { id: string }[] | null; error: { message: string } | null }) {
  const rows = check(res);
  if (!rows || rows.length === 0) {
    console.error('[data] no rows affected (missing row or access denied)');
    throw new UserError(GENERIC_ERROR);
  }
}

export type PositionRow = { id: string; position: number };

/** Rows of `table` that share the same value in `groupCol`, ordered by position. */
export async function siblings(db: SupabaseClient, table: string, groupCol: string, groupId: string | null) {
  const q = db.from(table).select('id,position').order('position').order('id');
  const res = await (groupId === null ? q.is(groupCol, null) : q.eq(groupCol, groupId));
  return check(res) as PositionRow[];
}

/** Writes contiguous positions 0..n-1 following `order`, touching only rows whose position changes. */
export async function renumber(db: SupabaseClient, table: string, order: string[], current: PositionRow[]) {
  const pos = new Map(current.map((r) => [r.id, r.position]));
  for (let p = 0; p < order.length; p++) {
    if (pos.get(order[p]) === p) continue;
    checkAffected(await db.from(table).update({ position: p }).eq('id', order[p]).select('id'));
  }
}

/** Swaps `id` with its neighbour among `rows`; no-op at the ends. */
export async function swapInGroup(db: SupabaseClient, table: string, rows: PositionRow[], id: string, direction: Direction) {
  const i = rows.findIndex((r) => r.id === id);
  const j = direction === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= rows.length) return;
  const order = rows.map((r) => r.id);
  [order[i], order[j]] = [order[j], order[i]];
  await renumber(db, table, order, rows);
}
