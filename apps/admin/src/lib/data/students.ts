import type { SupabaseClient } from '@supabase/supabase-js';
import { CONSOLIDATION_TYPE_LABELS, creditsLabel, type ConsolidationType } from '@prepio/shared';
import { deleteAccount } from '@/lib/account/deleteAccount';
import { check, isUuid, UserError } from './db';
import { getTree, type TreeNode } from './tree';

export const STUDENTS_PAGE_SIZE = 50;
const HISTORY_LIMIT = 100;

export type StudentRow = {
  id: string;
  displayName: string | null;
  email: string | null;
  creditBalance: number;
  createdAt: string;
  provider: string | null;
  suspendedAt: string | null;
  suspendedReason: string | null;
  reregistrationBlocked: boolean;
  lastActivityAt: string | null;
  lessonsFinished: number;
};

export type StudentFilter = 'all' | 'suspended' | 'active_today';
export const STUDENT_FILTERS: readonly StudentFilter[] = ['all', 'suspended', 'active_today'];

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

/** `provider` is 'none' while purchases are approved without a payment (mock fulfilment). */
export type AdminOrder = { id: string; credits: number; priceBani: number; status: string; provider: string; createdAt: string };

const ORDER_STATUS_LABELS: Record<string, string> = { pending: 'În așteptare', approved: 'Plătită', failed: 'Eșuată' };

/** The order's state for the owner: an order approved without a payment provider was never paid. */
export function orderStatusLabel(o: Pick<AdminOrder, 'status' | 'provider'>): string {
  if (o.status === 'approved' && o.provider === 'none') return 'Aprobată (fără plată)';
  return ORDER_STATUS_LABELS[o.status] ?? o.status;
}

type StudentDb = {
  id: string; display_name: string | null; email: string | null; credit_balance: number; created_at: string; total: number;
  provider: string | null; suspended_at: string | null; suspended_reason: string | null; reregistration_blocked: boolean;
  last_activity_at: string | null; lessons_finished: number;
};

const toStudent = (r: StudentDb): StudentRow => ({
  id: r.id,
  displayName: r.display_name,
  email: r.email,
  creditBalance: r.credit_balance,
  createdAt: r.created_at,
  provider: r.provider,
  suspendedAt: r.suspended_at,
  suspendedReason: r.suspended_reason,
  reregistrationBlocked: !!r.reregistration_blocked,
  lastActivityAt: r.last_activity_at,
  lessonsFinished: Number(r.lessons_finished ?? 0),
});

export async function listStudents(
  db: SupabaseClient,
  { search, page, filter = 'all' }: { search: string; page: number; filter?: StudentFilter },
): Promise<{ rows: StudentRow[]; total: number }> {
  const p = Number.isInteger(page) && page > 0 ? page : 1;
  const data = check(
    await db.rpc('admin_students', { p_search: search.trim(), p_limit: STUDENTS_PAGE_SIZE, p_offset: (p - 1) * STUDENTS_PAGE_SIZE, p_filter: filter }),
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
    await db
      .from('credit_orders')
      .select('id,credits,price_bani,status,provider,created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false }),
  ) as { id: string; credits: number; price_bani: number; status: string; provider: string; created_at: string }[];
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
    orders: orderRows.map((o) => ({
      id: o.id,
      credits: o.credits,
      priceBani: o.price_bani,
      status: o.status,
      provider: o.provider,
      createdAt: o.created_at,
    })),
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

// ---------------------------------------------------------------- progress

export type LessonProgressRow = {
  lessonId: string;
  title: string;
  status: 'not_started' | 'in_progress' | 'finished';
  where: string;
  lastActivityAt: string | null;
};

type Position = { phase?: string; index?: number } | null;

export type ProgressInput = {
  finishedAt: string | null;
  position: Position;
  cardsTotal: number;
  runIndex: number | null;
  runTotal: number | null;
  runFinishedAt: string | null;
};

/** Where the student is in a lesson, for the progress table. */
export function progressWhere(p: ProgressInput): string {
  if (p.runTotal != null) {
    if (p.runFinishedAt) return `Consolidare ${p.runTotal}/${p.runTotal}`;
    return `Consolidare ${(p.runIndex ?? 0) + 1}/${p.runTotal}`;
  }
  if (p.finishedAt) return 'Terminată';
  const pos = p.position;
  if (pos && typeof pos.index === 'number') {
    if (pos.phase === 'cards') return `Card ${pos.index + 1} din ${p.cardsTotal}`;
    if (pos.phase === 'questions') return `Verificare, întrebarea ${pos.index + 1}`;
  }
  return '—';
}

type ProgressDb = {
  lesson_id: string; finished_at: string | null; position: Position; progress_updated_at: string | null;
  cards_total: number; questions_total: number; run_index: number | null; run_total: number | null;
  run_finished_at: string | null; run_updated_at: string | null;
};

function flattenLessons(nodes: TreeNode[], out: { id: string; title: string; status: string }[] = []) {
  for (const n of nodes) {
    out.push(...n.lessons);
    flattenLessons(n.children, out);
  }
  return out;
}

const later = (a: string | null, b: string | null) => (a && b ? (a > b ? a : b) : (a ?? b));

/** Every published lesson in tree order (depth-first by position) with the student's status. */
export async function getStudentProgress(db: SupabaseClient, userId: string): Promise<LessonProgressRow[]> {
  const res = await db.rpc('admin_student_progress', { p_user: userId });
  if (res.error) throw rpcError(res.error);
  const byLesson = new Map((res.data as ProgressDb[]).map((r) => [r.lesson_id, r]));
  const lessons = flattenLessons(await getTree(db)).filter((l) => l.status === 'published');
  return lessons.map((l): LessonProgressRow => {
    const r = byLesson.get(l.id);
    if (!r) return { lessonId: l.id, title: l.title, status: 'not_started', where: '—', lastActivityAt: null };
    const hasRun = r.run_total != null;
    return {
      lessonId: l.id,
      title: l.title,
      status: r.finished_at ? 'finished' : 'in_progress',
      where: progressWhere({
        finishedAt: r.finished_at,
        position: r.position,
        cardsTotal: r.cards_total,
        runIndex: hasRun ? r.run_index : null,
        runTotal: hasRun ? r.run_total : null,
        runFinishedAt: r.run_finished_at,
      }),
      lastActivityAt: later(r.progress_updated_at, r.run_updated_at),
    };
  });
}

// ---------------------------------------------------------------- timeline

export type StudentEvent = { id: number; kind: string; createdAt: string; label: string; details: string | null };
export const EVENTS_PAGE_SIZE = 50;

export type EventInput = {
  kind: string;
  details: Record<string, unknown> | null;
  lessonTitle: string | null;
  exerciseType: string | null;
  adminEmail: string | null;
};

const MODE_LABELS: Record<string, string> = { guided: 'Traseu ghidat', free: 'Explorare liberă' };
const PROVIDER_LABELS: Record<string, string> = { google: 'Google', email: 'email' };

/** Romanian one-liner for a timeline entry. */
export function eventLabel(e: EventInput): string {
  const d = e.details ?? {};
  const num = (k: string) => Number(d[k] ?? 0);
  const lesson = e.lessonTitle != null ? `„${e.lessonTitle}”` : '(lecție ștearsă)';
  const admin = e.adminEmail ?? 'Admin';
  switch (e.kind) {
    case 'registered': {
      const prov = typeof d.provider === 'string' ? d.provider : 'email';
      return `S-a înregistrat cu ${PROVIDER_LABELS[prov] ?? prov}`;
    }
    case 'welcome_credits': return `A primit ${creditsLabel(num('credits'))} de bun venit`;
    case 'name_changed': return 'Și-a schimbat numele';
    case 'mode_changed': {
      const m = typeof d.mode === 'string' ? d.mode : '';
      return `A ales modul ${MODE_LABELS[m] ?? m}`;
    }
    case 'app_opened': return 'A intrat în aplicație';
    case 'lesson_started': return `A început lecția ${lesson}`;
    case 'lesson_finished': return `A terminat lecția ${lesson}`;
    case 'test_failed': return `Nu a trecut testul lecției ${lesson}`;
    case 'consolidation_started': return `A început consolidarea ${lesson}`;
    case 'consolidation_finished': return `A terminat consolidarea ${lesson}`;
    case 'check': {
      const type = e.exerciseType ? (CONSOLIDATION_TYPE_LABELS[e.exerciseType as ConsolidationType] ?? e.exerciseType) : null;
      return ['Verificare cu profesorul digital', type, `−${num('cost')}`].filter((x) => x != null).join(' · ');
    }
    case 'check_refunded': return 'Verificare nereușită · credite returnate';
    case 'check_blocked': return `Verificare blocată · avea ${num('balance')}, trebuiau ${num('required')}`;
    case 'purchase': return `A cumpărat ${creditsLabel(num('credits'))}`;
    case 'credits_adjusted': {
      const delta = num('delta');
      return `${admin}: credite ${delta > 0 ? '+' : '−'}${Math.abs(delta)} · ${d.reason ?? ''}`;
    }
    case 'suspended': return `${e.adminEmail ?? 'Sistem (reînregistrare blocată)'}: cont suspendat · „${d.reason ?? ''}”`;
    case 'reactivated': return `${admin}: cont reactivat`;
    case 'progress_reset': return `${admin}: parcurs resetat · ${d.scope === 'all' ? 'toate lecțiile' : `lecția ${lesson}`}`;
    default: return e.kind;
  }
}

type EventDb = {
  id: number; kind: string; details: Record<string, unknown> | null; created_at: string; lesson_id: string | null;
  lesson_title: string | null; exercise_type: string | null; exercise_prompt: string | null; admin_email: string | null;
};

/** 50 events, newest first; pass the last id as `before` for the next page. `details` holds the exercise prompt of a check. */
export async function getStudentEvents(db: SupabaseClient, userId: string, before?: number): Promise<StudentEvent[]> {
  const res = await db.rpc('admin_student_events', { p_user: userId, p_limit: EVENTS_PAGE_SIZE, p_before: before ?? null });
  if (res.error) throw rpcError(res.error);
  return (res.data as EventDb[]).map((r) => ({
    id: Number(r.id),
    kind: r.kind,
    createdAt: r.created_at,
    label: eventLabel({
      kind: r.kind, details: r.details, lessonTitle: r.lesson_title, exerciseType: r.exercise_type, adminEmail: r.admin_email,
    }),
    details: r.kind === 'check' ? r.exercise_prompt : null,
  }));
}

// ---------------------------------------------------------------- mutations

function rpcError(error: { message: string }): UserError {
  const m = error.message;
  if (m.includes('reason_required')) return new UserError('Motivul este obligatoriu.');
  if (m.includes('cannot_target_admin')) return new UserError('Conturile de administrator nu pot fi modificate aici.');
  if (m.includes('student_not_found')) return new UserError('Elevul nu a fost găsit.');
  if (m.includes('lesson_not_found')) return new UserError('Lecția nu a fost găsită.');
  console.error('[data] database error:', error);
  return new UserError('Operația a eșuat. Încearcă din nou.');
}

export async function suspendStudent(db: SupabaseClient, userId: string, reason: string): Promise<void> {
  if (!reason || !reason.trim()) throw new UserError('Motivul este obligatoriu.');
  const res = await db.rpc('admin_suspend_student', { p_user: userId, p_reason: reason.trim() });
  if (res.error) throw rpcError(res.error);
}

export async function reactivateStudent(db: SupabaseClient, userId: string): Promise<void> {
  const res = await db.rpc('admin_reactivate_student', { p_user: userId });
  if (res.error) throw rpcError(res.error);
}

export async function resetProgress(db: SupabaseClient, userId: string, lessonId: string | null): Promise<void> {
  const res = await db.rpc('admin_reset_progress', { p_user: userId, p_lesson: lessonId });
  if (res.error) throw rpcError(res.error);
}

/** `serviceDb` is the service-role client; the caller must have verified the session is an admin. */
export async function deleteStudent(
  serviceDb: SupabaseClient,
  userId: string,
  { confirmEmail, block, reason }: { confirmEmail: string; block: boolean; reason: string },
): Promise<void> {
  const got = await serviceDb.auth.admin.getUserById(userId);
  const studentEmail = got.data?.user?.email;
  if (got.error || !studentEmail) throw new UserError('Elevul nu a fost găsit.');
  if (confirmEmail.trim().toLowerCase() !== studentEmail.trim().toLowerCase()) throw new UserError('Emailul nu se potrivește.');
  const result = await deleteAccount(userId, serviceDb, block ? { blockReason: reason } : undefined);
  if (result === 'forbidden_admin') throw new UserError('Conturile de administrator nu pot fi modificate aici.');
}
