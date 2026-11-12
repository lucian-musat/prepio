import type { SupabaseClient } from '@supabase/supabase-js';
import { CONSOLIDATION_TYPE_LABELS, creditsLabel, formatAccessDate, formatGrade, formatLei, type ConsolidationType } from '@prepio/shared';
import { deleteAccount } from '@/lib/account/deleteAccount';
import { check, isUuid, UserError } from './db';
import { MODE_LABELS, PROVIDER_LABELS, type LearningMode } from './studentLabels';
import { getTree, type TreeNode } from './tree';

export type { LearningMode } from './studentLabels';

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
  /** End of the paid access (may be in the past); null when never bought or granted. */
  accessUntil: string | null;
  /** An admin who used the student app: listed and readable, but every account action refuses them. */
  isAdmin: boolean;
};

export type StudentFilter = 'all' | 'suspended' | 'active_today' | 'trial' | 'full';
export const STUDENT_FILTERS: readonly StudentFilter[] = ['all', 'suspended', 'active_today', 'trial', 'full'];

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
  /** Set when `target` is `bac:<subject id>`: the subject's title (null when the subject no longer exists). */
  bacSubjectTitle: string | null;
  /** `referral`: the rewarded invitee; `access_bonus`: set when the bonus came with a free access from referrals. */
  referralId?: string | null;
  /** `access_bonus` of a purchase: its access order. */
  accessOrderId?: string | null;
};

/** `bac:<uuid>` ledger target -> the subject id. */
const bacSubjectOf = (target: string | null): string | null => {
  const id = target?.startsWith('bac:') ? target.slice(4) : null;
  return id && isUuid(id) ? id : null;
};

/** Subject id -> title, for the ids that still exist (admins can read every subject). */
async function subjectTitles(db: SupabaseClient, ids: Iterable<string | null>): Promise<Map<string, string>> {
  const unique = [...new Set([...ids].filter((x): x is string => !!x && isUuid(x)))];
  if (unique.length === 0) return new Map();
  const rows = check(await db.from('bac_subjects').select('id,title').in('id', unique)) as { id: string; title: string }[];
  return new Map(rows.map((r) => [r.id, r.title]));
}

/** Detail text of a ledger row: a BAC grading names the subject; otherwise the exercise and the reason. */
export function ledgerDetails(
  e: Pick<AdminLedgerEntry, 'kind' | 'target' | 'reason' | 'adminEmail' | 'exerciseType' | 'exercisePrompt' | 'bacSubjectTitle' | 'referralId' | 'accessOrderId'>,
): string {
  if (e.kind === 'admin') return [e.reason, e.adminEmail].filter(Boolean).join(' · ');
  if (e.kind === 'referral') return 'Invitat care a plătit';
  if (e.kind === 'access_bonus' && e.referralId) return 'Acces gratuit din recomandări';
  if (e.kind === 'access_bonus' && e.accessOrderId) return 'Acces cumpărat';
  const parts: string[] = [];
  if (bacSubjectOf(e.target)) parts.push(`Corectare subiect · ${e.bacSubjectTitle ?? '(subiect șters)'}`);
  if (e.exerciseType) {
    const label = CONSOLIDATION_TYPE_LABELS[e.exerciseType as ConsolidationType] ?? e.exerciseType;
    const prompt = e.exercisePrompt ? (e.exercisePrompt.length > 60 ? `${e.exercisePrompt.slice(0, 60)}…` : e.exercisePrompt) : '';
    parts.push(prompt ? `${label}: ${prompt}` : label);
  }
  if (e.reason) parts.push(e.reason);
  return parts.join(' · ');
}

/**
 * A credit order (`kind: 'credits'`, has `credits`) or an access order (`kind: 'access'`, has `durationMonths` and
 * `bonusCredits`). `provider` is 'none' while purchases are approved without a payment (mock fulfilment).
 */
export type AdminOrder = {
  id: string;
  kind: 'credits' | 'access';
  credits: number | null;
  durationMonths: number | null;
  bonusCredits: number | null;
  priceBani: number;
  status: string;
  provider: string;
  createdAt: string;
};

const monthsLabel = (n: number) => (n === 1 ? '1 lună' : `${n} luni`);

/** "150,00 lei": access prices always show bani, as admins read them in the orders and the timeline. */
const leiExact = (bani: number) => `${(bani / 100).toFixed(2).replace('.', ',')} lei`;

export const orderPrice = (o: Pick<AdminOrder, 'priceBani' | 'kind'>) => (o.kind === 'access' ? leiExact(o.priceBani) : formatLei(o.priceBani));

/** "Acces 3 luni · +100 credite" or "20 de credite". */
export function orderLabel(o: AdminOrder): string {
  if (o.kind === 'credits') return creditsLabel(o.credits ?? 0);
  const bonus = o.bonusCredits ?? 0;
  return `Acces ${monthsLabel(o.durationMonths ?? 0)}${bonus > 0 ? ` · +${bonus} ${bonus === 1 ? 'credit' : 'credite'}` : ''}`;
}

/** Credit and access orders in one list, newest first. */
export function mergeOrders(...lists: AdminOrder[][]): AdminOrder[] {
  return lists.flat().sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

const ORDER_STATUS_LABELS: Record<string, string> = { pending: 'În așteptare', approved: 'Plătită', failed: 'Eșuată' };

/** The order's state for the owner: an order approved without a payment provider was never paid. */
export function orderStatusLabel(o: Pick<AdminOrder, 'status' | 'provider'>): string {
  if (o.status === 'approved' && o.provider === 'none') return 'Aprobată (fără plată)';
  return ORDER_STATUS_LABELS[o.status] ?? o.status;
}

type StudentDb = {
  id: string; display_name: string | null; email: string | null; credit_balance: number; created_at: string; total: number;
  provider: string | null; suspended_at: string | null; suspended_reason: string | null; reregistration_blocked: boolean;
  last_activity_at: string | null; lessons_finished: number; access_until: string | null; is_admin: boolean;
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
  accessUntil: r.access_until ?? null,
  isAdmin: !!r.is_admin,
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
    referral_id?: string | null; access_order_id?: string | null;
  }[];
  const orderRows = check(
    await db
      .from('credit_orders')
      .select('id,credits,price_bani,status,provider,created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false }),
  ) as { id: string; credits: number; price_bani: number; status: string; provider: string; created_at: string }[];
  const accessRows = check(await db.rpc('admin_access_orders', { p_user: id })) as {
    id: string; price_bani: number; bonus_credits: number; duration_months: number; status: string; provider: string; created_at: string;
  }[];
  const titles = await subjectTitles(db, ledgerRows.map((r) => bacSubjectOf(r.target)));
  return {
    student: toStudent(found[0]),
    ledger: ledgerRows.map((r) => ({
      bacSubjectTitle: titles.get(bacSubjectOf(r.target) ?? '') ?? null,
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
      referralId: r.referral_id ?? null,
      accessOrderId: r.access_order_id ?? null,
    })),
    orders: mergeOrders(
      orderRows.map((o): AdminOrder => ({
        id: o.id,
        kind: 'credits',
        credits: o.credits,
        durationMonths: null,
        bonusCredits: null,
        priceBani: o.price_bani,
        status: o.status,
        provider: o.provider,
        createdAt: o.created_at,
      })),
      accessRows.map((o): AdminOrder => ({
        id: o.id,
        kind: 'access',
        credits: null,
        durationMonths: o.duration_months,
        bonusCredits: o.bonus_credits,
        priceBani: o.price_bani,
        status: o.status,
        provider: o.provider,
        createdAt: o.created_at,
      })),
    ),
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

/**
 * Profile fields admins can't read through RLS: the learning mode and who suspended the student (their email, or
 * null for the system / no suspender). `serviceDb` is the service-role client; call it only after `getStudent`
 * succeeded with the session client, which proves the caller is an admin.
 */
export async function getStudentAccount(
  serviceDb: SupabaseClient,
  userId: string,
): Promise<{ mode: LearningMode | null; suspendedBy: string | null }> {
  const res = await serviceDb.from('profiles').select('learning_mode,suspended_by').eq('id', userId).maybeSingle();
  const p = check(res) as { learning_mode: LearningMode | null; suspended_by: string | null } | null;
  let suspendedBy: string | null = null;
  if (p?.suspended_by) {
    const got = await serviceDb.auth.admin.getUserById(p.suspended_by);
    suspendedBy = got.data?.user?.email ?? null;
  }
  return { mode: p?.learning_mode ?? null, suspendedBy };
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

export type StudentEvent = { id: number; kind: string; createdAt: string; label: string; details: string | null; icon?: string };
export const EVENTS_PAGE_SIZE = 50;

export type EventInput = {
  kind: string;
  details: Record<string, unknown> | null;
  lessonTitle: string | null;
  exerciseType: string | null;
  adminEmail: string | null;
  /** Title of the BAC subject of a `bac_*` event, when it still exists. */
  subjectTitle?: string | null;
};


/** Romanian one-liner for a timeline entry. */
export function eventLabel(e: EventInput): string {
  const d = e.details ?? {};
  const num = (k: string) => Number(d[k] ?? 0);
  const lesson = e.lessonTitle != null ? `„${e.lessonTitle}”` : '(lecție ștearsă)';
  const admin = e.adminEmail ?? 'Admin';
  const subject = e.subjectTitle ?? '(subiect șters)';
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
      if (typeof d.target === 'string' && d.target.startsWith('bac:')) return `Corectare subiect BAC · −${num('cost')}`;
      const type = e.exerciseType ? (CONSOLIDATION_TYPE_LABELS[e.exerciseType as ConsolidationType] ?? e.exerciseType) : null;
      return ['Verificare cu profesorul digital', type, `−${num('cost')}`].filter((x) => x != null).join(' · ');
    }
    case 'check_refunded': return 'Verificare nereușită · credite returnate';
    case 'check_blocked':
      if (d.reason === 'access_required') return 'Verificare refuzată · lecție fără acces';
      return `Verificare blocată · avea ${num('balance')}, trebuiau ${num('required')}`;
    case 'purchase': return `A cumpărat ${creditsLabel(num('credits'))}`;
    case 'credits_adjusted': {
      const delta = num('delta');
      return `${admin}: credite ${delta > 0 ? '+' : '−'}${Math.abs(delta)} · ${d.reason ?? ''}`;
    }
    case 'suspended': return `${e.adminEmail ?? 'Sistem (reînregistrare blocată)'}: cont suspendat · „${d.reason ?? ''}”`;
    case 'reactivated': return `${admin}: cont reactivat`;
    case 'progress_reset': return `${admin}: parcurs resetat · ${d.scope === 'all' ? 'toate lecțiile' : `lecția ${lesson}`}`;
    case 'access_purchased': return `Acces cumpărat · ${monthsLabel(num('months'))} · ${leiExact(num('price_bani'))}`;
    case 'access_granted': return `${admin}: acces acordat · ${monthsLabel(num('months'))} · Motiv: „${d.reason ?? ''}”`;
    case 'access_revoked': return `${admin}: acces retras · Motiv: „${d.reason ?? ''}”`;
    case 'access_expired': return 'Accesul a expirat';
    case 'bac_started': return `Subiect BAC început · ${subject}`;
    case 'bac_submitted': return `Lucrare trimisă la corectat · ${subject} · 🪙 ${num('cost')}`;
    case 'bac_graded': return `Lucrare corectată · ${subject} · nota ${formatGrade(num('grade'))}`;
    case 'bac_grading_failed': return 'Corectare nereușită · returnat';
    case 'referral_joined': {
      const n = typeof d.inviter_first_name === 'string' && d.inviter_first_name ? d.inviter_first_name : null;
      return n ? `S-a înregistrat cu codul de recomandare al lui ${n}` : 'S-a înregistrat cu un cod de recomandare';
    }
    case 'referral_access': {
      const parts = [
        num('months') > 0 ? monthsLabel(num('months')) : null,
        typeof d.until === 'string' ? `până la ${formatAccessDate(new Date(d.until))}` : null,
        num('bonus_credits') > 0 ? `+${num('bonus_credits')} ${num('bonus_credits') === 1 ? 'credit inclus' : 'credite incluse'}` : null,
      ].filter(Boolean);
      return `Acces gratuit prin recomandări${parts.length ? ` (${parts.join(', ')})` : ''}`;
    }
    case 'referral_credits': return `Credite din recomandare: +${num('credits')}`;
    default: return e.kind;
  }
}

const EVENT_ICONS: Record<string, string> = { access_purchased: '⭐', access_granted: '🎟️', access_revoked: '⛔', access_expired: '⌛',
  referral_joined: '🤝', referral_access: '🎁', referral_credits: '🪙',
  bac_started: '📝', bac_submitted: '📤', bac_graded: '🎓', bac_grading_failed: '⚠️',
};

/** Icon that overrides the tab's default for the event, or undefined to use the default. */
export function eventIcon(kind: string, details: Record<string, unknown> | null): string | undefined {
  if (kind === 'check_blocked' && details?.reason === 'access_required') return '🚫';
  return EVENT_ICONS[kind];
}

type EventDb = {
  id: number; kind: string; details: Record<string, unknown> | null; created_at: string; lesson_id: string | null;
  lesson_title: string | null; exercise_type: string | null; exercise_prompt: string | null; admin_email: string | null;
};

/** 50 events, newest first; pass the last id as `before` for the next page. `details` holds the exercise prompt of a check. */
export async function getStudentEvents(db: SupabaseClient, userId: string, before?: number): Promise<StudentEvent[]> {
  const res = await db.rpc('admin_student_events', { p_user: userId, p_limit: EVENTS_PAGE_SIZE, p_before: before ?? null });
  if (res.error) throw rpcError(res.error);
  const rows = res.data as EventDb[];
  const subjectId = (r: EventDb) => (r.kind.startsWith('bac_') && typeof r.details?.subject_id === 'string' ? r.details.subject_id : null);
  const titles = await subjectTitles(db, rows.map(subjectId));
  return rows.map((r) => ({
    id: Number(r.id),
    kind: r.kind,
    createdAt: r.created_at,
    label: eventLabel({
      kind: r.kind, details: r.details, lessonTitle: r.lesson_title, exerciseType: r.exercise_type, adminEmail: r.admin_email,
      subjectTitle: titles.get(subjectId(r) ?? '') ?? null,
    }),
    details: r.kind === 'check' ? r.exercise_prompt : null,
    icon: eventIcon(r.kind, r.details),
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

const ACCESS_ERRORS: [string, string][] = [
  ['reason_required', 'Scrie motivul.'],
  ['bad_months', 'Alege între 1 și 24 de luni.'],
  ['not_active', 'Elevul nu are acces activ.'],
  ['cannot_target_admin', 'Nu poți modifica accesul unui administrator.'],
  ['student_not_found', 'Elevul nu mai există.'],
  ['forbidden', 'Nu ai drepturi de administrator.'],
];

function accessError(error: { message: string }): UserError {
  const hit = ACCESS_ERRORS.find(([code]) => error.message.includes(code));
  if (hit) return new UserError(hit[1]);
  console.error('[data] database error:', error);
  return new UserError('Operația a eșuat. Încearcă din nou.');
}

/** Adds `months` to the student's access (no credits); returns the new end date (ISO). */
export async function grantAccess(db: SupabaseClient, userId: string, months: number, reason: string): Promise<string> {
  if (!Number.isInteger(months) || months < 1 || months > 24) throw new UserError('Alege între 1 și 24 de luni.');
  if (!reason || !reason.trim()) throw new UserError('Scrie motivul.');
  const res = await db.rpc('admin_grant_access', { p_user: userId, p_months: months, p_reason: reason.trim() });
  if (res.error) throw accessError(res.error);
  return res.data as string;
}

/** Ends the student's access now; credits stay. */
export async function revokeAccess(db: SupabaseClient, userId: string, reason: string): Promise<void> {
  if (!reason || !reason.trim()) throw new UserError('Scrie motivul.');
  const res = await db.rpc('admin_revoke_access', { p_user: userId, p_reason: reason.trim() });
  if (res.error) throw accessError(res.error);
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
