import type { SupabaseClient } from '@supabase/supabase-js';
import { check, isUuid, UserError } from './db';

export const STUDENTS_PAGE_SIZE = 50;
const HISTORY_LIMIT = 100;

export type StudentRow = { id: string; displayName: string | null; email: string | null; creditBalance: number; createdAt: string };

export type AdminLedgerEntry = {
  id: number;
  delta: number;
  balanceAfter: number;
  kind: string;
  target: string | null;
  reason: string | null;
  createdAt: string;
  exerciseId: string | null;
  exerciseType: string | null;
  exercisePrompt: string | null;
  adminEmail: string | null;
};

export type AdminOrder = { id: string; credits: number; priceBani: number; status: string; createdAt: string };

type StudentDb = { id: string; display_name: string | null; email: string | null; credit_balance: number; created_at: string; total: number };

const toStudent = (r: StudentDb): StudentRow => ({
  id: r.id,
  displayName: r.display_name,
  email: r.email,
  creditBalance: r.credit_balance,
  createdAt: r.created_at,
});

export async function listStudents(
  db: SupabaseClient,
  { search, page }: { search: string; page: number },
): Promise<{ rows: StudentRow[]; total: number }> {
  const p = Number.isInteger(page) && page > 0 ? page : 1;
  const data = check(
    await db.rpc('admin_students', { p_search: search.trim(), p_limit: STUDENTS_PAGE_SIZE, p_offset: (p - 1) * STUDENTS_PAGE_SIZE }),
  ) as StudentDb[];
  return { rows: data.map(toStudent), total: data.length ? Number(data[0].total) : 0 };
}

export async function getStudent(
  db: SupabaseClient,
  id: string,
): Promise<{ student: StudentRow; ledger: AdminLedgerEntry[]; orders: AdminOrder[] } | null> {
  if (!isUuid(id)) return null;
  const found = check(await db.rpc('admin_students', { p_search: '', p_limit: 1, p_offset: 0, p_id: id })) as StudentDb[];
  if (!found.length) return null;
  const ledgerRows = check(await db.rpc('admin_credit_ledger', { p_user: id, p_limit: HISTORY_LIMIT })) as {
    id: number; delta: number; balance_after: number; kind: string; target: string | null; reason: string | null;
    created_at: string; exercise_id: string | null; exercise_type: string | null; exercise_prompt: string | null; admin_email: string | null;
  }[];
  const orderRows = check(
    await db.from('credit_orders').select('id,credits,price_bani,status,created_at').eq('user_id', id).order('created_at', { ascending: false }),
  ) as { id: string; credits: number; price_bani: number; status: string; created_at: string }[];
  return {
    student: toStudent(found[0]),
    ledger: ledgerRows.map((r) => ({
      id: r.id,
      delta: r.delta,
      balanceAfter: r.balance_after,
      kind: r.kind,
      target: r.target,
      reason: r.reason,
      createdAt: r.created_at,
      exerciseId: r.exercise_id,
      exerciseType: r.exercise_type,
      exercisePrompt: r.exercise_prompt,
      adminEmail: r.admin_email,
    })),
    orders: orderRows.map((o) => ({ id: o.id, credits: o.credits, priceBani: o.price_bani, status: o.status, createdAt: o.created_at })),
  };
}

/** Returns the new balance. */
export async function adjustCredits(db: SupabaseClient, userId: string, delta: number, reason: string): Promise<number> {
  if (!Number.isInteger(delta) || delta === 0) throw new UserError('Introdu un număr diferit de 0.');
  if (!reason || !reason.trim()) throw new UserError('Motivul este obligatoriu.');
  const res = await db.rpc('admin_adjust_credits', { p_user: userId, p_delta: delta, p_reason: reason.trim() });
  if (res.error) {
    const m = res.error.message;
    if (m.includes('reason_required')) throw new UserError('Motivul este obligatoriu.');
    if (m.includes('insufficient_balance')) throw new UserError('Soldul nu poate deveni negativ.');
    if (m.includes('bad_delta')) throw new UserError('Introdu un număr diferit de 0.');
  }
  return check(res) as number;
}
