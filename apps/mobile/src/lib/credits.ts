import {
  CONSOLIDATION_TYPE_LABELS,
  creditsLabel,
  type ConsolidationType,
  type CreditLedgerKind,
  type CreditPackage,
  type CreditsPurchaseError,
  type CreditsPurchaseErrorCode,
  type CreditsPurchaseResponse,
} from '@prepio/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { accountSuspended, bearerToken, missingApiUrl, OFFLINE, SESSION_EXPIRED, sessionExpired } from './api';
import { apiUrl, getSupabase } from './supabase';

export class CreditsApiError extends Error {
  code: CreditsPurchaseErrorCode;
  constructor(code: CreditsPurchaseErrorCode, message: string) {
    super(message);
    this.name = 'CreditsApiError';
    this.code = code;
  }
}

export const PURCHASE_TIMEOUT_MS = 15_000;
export const PURCHASE_FAILED = 'Achiziția nu a reușit. Încearcă din nou.';
const PURCHASE_TIMEOUT = 'Achiziția durează prea mult. Încearcă din nou.';
const PURCHASE_NOT_CONFIGURED = 'Achiziția nu este disponibilă momentan. Încearcă din nou mai târziu.';

export type StudentLedgerEntry = {
  id: number;
  delta: number;
  balanceAfter: number;
  kind: CreditLedgerKind;
  target: string | null;
  reason: string | null;
  createdAt: string;
  /** `lesson`: the title of the exercise's lesson, when the student can read it (published). */
  exercise: { type: ConsolidationType; prompt: string; requirements?: string[]; lesson?: string } | null;
};

const DEFAULT_LEDGER_LIMIT = 30;

type JoinedExercise = {
  type: ConsolidationType;
  prompt: string;
  content?: { requirements?: Array<{ id: string }> } | null;
  lessons?: { title: string | null } | Array<{ title: string | null }> | null;
};

/** Active packages, in the admin's order. */
export async function fetchCreditPackages(client: SupabaseClient = getSupabase()): Promise<CreditPackage[]> {
  const { data, error } = await client
    .from('credit_packages')
    .select('id,credits,price_bani,featured')
    .eq('active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, credits: r.credits, priceBani: r.price_bani, featured: r.featured }));
}

/** The student's own ledger, newest first; `before` is the id of the last row already loaded. */
export async function fetchLedger(
  opts: { before?: number; limit?: number } = {},
  client: SupabaseClient = getSupabase(),
): Promise<StudentLedgerEntry[]> {
  let q = client
    .from('credit_ledger')
    .select('id,delta,balance_after,kind,target,reason,created_at,consolidation_exercises(type,prompt,content,lessons(title))')
    .order('id', { ascending: false })
    .limit(opts.limit ?? DEFAULT_LEDGER_LIMIT);
  if (opts.before !== undefined) q = q.lt('id', opts.before);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => {
    const joined = r.consolidation_exercises as JoinedExercise | JoinedExercise[] | null;
    const ex = Array.isArray(joined) ? (joined[0] ?? null) : joined;
    const reqs = ex?.type === 'essay' ? ex.content?.requirements?.map((x) => x.id) : undefined;
    const lessonRow = Array.isArray(ex?.lessons) ? (ex.lessons[0] ?? null) : (ex?.lessons ?? null);
    const lesson = lessonRow?.title?.trim() || undefined;
    return {
      id: r.id,
      delta: r.delta,
      balanceAfter: r.balance_after,
      kind: r.kind,
      target: r.target,
      reason: r.reason,
      createdAt: r.created_at,
      exercise: ex
        ? { type: ex.type, prompt: ex.prompt, ...(reqs ? { requirements: reqs } : {}), ...(lesson ? { lesson } : {}) }
        : null,
    };
  });
}

/** The student's current balance from their own profile row (null when there is no row). */
export async function fetchCreditBalance(userId: string, client: SupabaseClient = getSupabase()): Promise<number | null> {
  const { data, error } = await client.from('profiles').select('credit_balance').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data ? data.credit_balance : null;
}

/** A check or refund row names its exercise (type, essay part) and its lesson: „Punct de vedere · Cuza”. */
export function ledgerLabel(e: StudentLedgerEntry): string {
  const lesson = (e.kind === 'check' || e.kind === 'refund') && e.exercise?.lesson ? ` · ${e.exercise.lesson}` : '';
  return base(e) + lesson;
}

function base(e: StudentLedgerEntry): string {
  switch (e.kind) {
    case 'welcome':
      return 'Credite de bun venit';
    case 'purchase':
      return `Pachet ${creditsLabel(e.delta)}`;
    case 'refund':
      return 'Verificare nereușită · returnat';
    case 'admin':
      return e.reason?.trim() ? `Ajustare · ${e.reason.trim()}` : 'Ajustare';
    case 'check': {
      if (!e.exercise) return 'Verificare';
      const base = e.exercise.type === 'essay' ? 'Eseu' : CONSOLIDATION_TYPE_LABELS[e.exercise.type];
      if (e.exercise.type !== 'essay') return base;
      // Old ledger rows still carry the removed whole-essay target.
      if (e.target === 'whole') return `${base} · eseul întreg`;
      if (e.target?.startsWith('req:')) {
        const n = (e.exercise.requirements ?? []).indexOf(e.target.slice(4)) + 1;
        if (n > 0) return `${base} · cerința ${n}`;
      }
      return base;
    }
  }
}

/** Buys a package (the server fulfils it as a mock payment for now). Throws CreditsApiError; 401 also signs out. */
export async function purchaseCredits(packageId: string): Promise<CreditsPurchaseResponse> {
  const base = apiUrl();
  if (!base) {
    missingApiUrl('purchaseCredits');
    throw new CreditsApiError('server_error', PURCHASE_NOT_CONFIGURED);
  }
  const token = await bearerToken(() => new CreditsApiError('server_error', OFFLINE));
  if (!token) return sessionExpired(new CreditsApiError('unauthorized', SESSION_EXPIRED));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PURCHASE_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(`${base}/api/credits/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ packageId }),
        signal: controller.signal,
      });
    } catch {
      throw new CreditsApiError('server_error', controller.signal.aborted ? PURCHASE_TIMEOUT : OFFLINE);
    }
    if (res.status === 401) return sessionExpired(new CreditsApiError('unauthorized', SESSION_EXPIRED));
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // Non-JSON (gateway page): generic message below.
    }
    if (!res.ok) {
      const e = body as Partial<CreditsPurchaseError> | null;
      const error = new CreditsApiError(e?.error ?? 'server_error', e?.message || PURCHASE_FAILED);
      if (res.status === 403 && error.code === 'suspended') return accountSuspended(error);
      throw error;
    }
    const ok = body as Partial<CreditsPurchaseResponse> | null;
    if (!ok || typeof ok.balance !== 'number') {
      throw new CreditsApiError('server_error', controller.signal.aborted ? PURCHASE_TIMEOUT : PURCHASE_FAILED);
    }
    return ok as CreditsPurchaseResponse;
  } finally {
    clearTimeout(timer);
  }
}
