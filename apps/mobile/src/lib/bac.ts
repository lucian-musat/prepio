import type { SupabaseClient } from '@supabase/supabase-js';
import {
  bacItemFromRow,
  sourceFromRow,
  templateFromRow,
  type BacAnswers,
  type BacAttemptStatus,
  type BacItem,
  type BacItemResult,
  type BacSection,
  type BacSubjectSummary,
  type BacSubmitError,
  type BacSubmitErrorCode,
  type BacSubmitRequest,
  type BacSubmitResponse,
  type CreditsChange,
  type ExerciseAnswer,
  type SolutionTemplate,
  type Source,
  type SourceLabel,
} from '@prepio/shared';
import {
  accountSuspended,
  bearerToken,
  EVALUATE_TIMEOUT_MS,
  missingApiUrl,
  OFFLINE,
  SESSION_EXPIRED,
  sessionExpired,
} from './api';
import { refreshRegisteredAccess } from './profileRefresh';
import { apiUrl, getSupabase } from './supabase';

export type BacPosition = { section: BacSection; index: number };

export type BacListRow = BacSubjectSummary & {
  state: 'new' | 'draft' | 'grading' | 'failed' | 'completed';
  lastGrade: number | null;
  position: BacPosition | null;
};

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

/**
 * Published subjects (year desc, then the admin's order) with the student's state on each. Trial students have no
 * readable attempts (RLS), so every subject is `new` for them. An open attempt wins over history.
 */
export async function fetchBacList(client: SupabaseClient = getSupabase()): Promise<BacListRow[]> {
  const [subRes, attRes] = await Promise.all([
    client
      .from('bac_subjects')
      .select('id,title,year,variant,credit_cost,position')
      .eq('published', true)
      .order('year', { ascending: false })
      .order('position'),
    client.from('bac_attempts').select('subject_id,status,grade,position,graded_at'),
  ]);
  if (subRes.error) throw subRes.error;
  if (attRes.error) throw attRes.error;
  const attempts: any[] = attRes.data ?? [];
  const subjects: any[] = [...(subRes.data ?? [])].sort((a, b) => b.year - a.year || a.position - b.position);
  return subjects.map((s) => {
    const mine = attempts.filter((a) => a.subject_id === s.id);
    const open = mine.find((a) => a.status === 'draft' || a.status === 'grading' || a.status === 'failed');
    const graded = mine
      .filter((a) => a.status === 'graded')
      .sort((a, b) => String(b.graded_at ?? '').localeCompare(String(a.graded_at ?? '')))[0];
    const state: BacListRow['state'] = open ? (open.status as 'draft' | 'grading' | 'failed') : graded ? 'completed' : 'new';
    return {
      id: s.id,
      title: s.title,
      year: s.year,
      variant: s.variant ?? '',
      creditCost: s.credit_cost,
      state,
      lastGrade: graded?.grade != null ? Number(graded.grade) : null,
      position: open?.position ?? null,
    };
  });
}

export type BacPaper = {
  subject: BacSubjectSummary;
  sources: Array<Source & { section: BacSection }>;
  items: BacItem[];
  templates: Record<string, SolutionTemplate>;
};

/** The whole paper, or null when the subject is not readable (unpublished) or the student has no full access. */
export async function fetchBacPaper(subjectId: string, client: SupabaseClient = getSupabase()): Promise<BacPaper | null> {
  const subRes = await client
    .from('bac_subjects')
    .select('id,title,year,variant,credit_cost')
    .eq('id', subjectId)
    .maybeSingle();
  if (subRes.error) throw subRes.error;
  if (!subRes.data) return null;
  const [srcRes, itemRes] = await Promise.all([
    client.from('bac_sources').select('*').eq('subject_id', subjectId).order('position'),
    client.from('bac_items').select('*, bac_item_sources(source_id,label,position)').eq('subject_id', subjectId).order('position'),
  ]);
  if (srcRes.error) throw srcRes.error;
  if (itemRes.error) throw itemRes.error;
  const itemRows: any[] = itemRes.data ?? [];
  // Trial students read nothing here (RLS): there is no paper to show.
  if (itemRows.length === 0) return null;

  const sources = [...(srcRes.data ?? [])]
    .sort(byPosition)
    .map((r: any) => ({ ...sourceFromRow(r), section: r.section as BacSection }));

  const counters: Record<number, number> = {};
  const items = [...itemRows]
    .sort((a, b) => a.section - b.section || a.position - b.position)
    .map((r) => {
      counters[r.section] = (counters[r.section] ?? 0) + 1;
      const refs = [...(r.bac_item_sources ?? [])]
        .sort(byPosition)
        .map((s: any) => ({ sourceId: s.source_id as string, label: s.label as SourceLabel }));
      return bacItemFromRow(r, counters[r.section], refs);
    });

  const templateIds = [
    ...new Set(
      items.flatMap((e) => [
        ...(e.templateId ? [e.templateId] : []),
        ...(e.type === 'essay' ? e.requirements.flatMap((r) => (r.templateId ? [r.templateId] : [])) : []),
      ]),
    ),
  ];
  const templates: Record<string, SolutionTemplate> = {};
  if (templateIds.length) {
    const tplRes = await client.from('solution_templates').select('*').in('id', templateIds);
    if (tplRes.error) throw tplRes.error;
    for (const r of tplRes.data ?? []) {
      const t = templateFromRow(r as Record<string, unknown>);
      templates[t.id] = t;
    }
  }
  const s: any = subRes.data;
  return {
    subject: { id: s.id, title: s.title, year: s.year, variant: s.variant ?? '', creditCost: s.credit_cost },
    sources,
    items,
    templates,
  };
}

export type BacAttemptView = {
  id: string;
  status: BacAttemptStatus;
  answers: BacAnswers;
  position: BacPosition | null;
  points: number | null;
  grade: number | null;
  results: BacItemResult[] | null;
  gradedAt: string | null;
};

const ATTEMPT_COLUMNS = 'id,status,answers,position,points,grade,results,graded_at';

function attemptView(r: any): BacAttemptView {
  return {
    id: r.id,
    status: r.status,
    answers: r.answers ?? {},
    position: r.position ?? null,
    points: r.points ?? null,
    grade: r.grade != null ? Number(r.grade) : null,
    results: r.results ?? null,
    gradedAt: r.graded_at ?? null,
  };
}

/** The student's draft / grading / failed attempt of a subject, if any (at most one exists). */
export async function fetchOpenAttempt(subjectId: string, client: SupabaseClient = getSupabase()): Promise<BacAttemptView | null> {
  const { data, error } = await client
    .from('bac_attempts')
    .select(ATTEMPT_COLUMNS)
    .eq('subject_id', subjectId)
    .in('status', ['draft', 'grading', 'failed'])
    .maybeSingle();
  if (error) throw error;
  return data ? attemptView(data) : null;
}

/** The most recent graded attempt of a subject, if any. */
export async function fetchLatestGraded(subjectId: string, client: SupabaseClient = getSupabase()): Promise<BacAttemptView | null> {
  const { data, error } = await client
    .from('bac_attempts')
    .select(ATTEMPT_COLUMNS)
    .eq('subject_id', subjectId)
    .eq('status', 'graded')
    .order('graded_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? attemptView(data) : null;
}

/** The draft cannot be saved: the paper is being graded. */
export class BacDraftLocked extends Error {
  constructor() {
    super('Subiectul este în curs de corectare.');
    this.name = 'BacDraftLocked';
  }
}

export async function saveBacDraft(
  subjectId: string,
  answers: BacAnswers,
  position: BacPosition,
  client: SupabaseClient = getSupabase(),
): Promise<void> {
  const { error } = await client.rpc('save_bac_draft', { p_subject: subjectId, p_answers: answers, p_position: position });
  if (!error) return;
  if (error.code === 'P0001' && error.message === 'grading') throw new BacDraftLocked();
  throw error;
}

export class BacApiError extends Error {
  code: BacSubmitErrorCode;
  required?: number;
  balance?: number;
  /** Only on `grading_failed`: the refunded balance. */
  credits?: CreditsChange;
  constructor(
    code: BacSubmitErrorCode,
    message: string,
    extra?: { required?: number; balance?: number; credits?: CreditsChange },
  ) {
    super(message);
    this.name = 'BacApiError';
    this.code = code;
    this.required = extra?.required;
    this.balance = extra?.balance;
    this.credits = extra?.credits;
  }
}

const GRADING_FAILED = 'Corectarea nu a reușit. Nu ți-am luat niciun credit. Încearcă din nou.';
const TIMEOUT = 'Corectarea durează prea mult. Încearcă din nou.';
const NOT_CONFIGURED = 'Corectarea nu este disponibilă momentan. Încearcă din nou mai târziu.';

export async function submitBac(req: BacSubmitRequest): Promise<BacSubmitResponse> {
  const base = apiUrl();
  if (!base) {
    missingApiUrl('submitBac');
    throw new BacApiError('grading_failed', NOT_CONFIGURED);
  }
  const token = await bearerToken(() => new BacApiError('grading_failed', OFFLINE));
  if (!token) return sessionExpired(new BacApiError('unauthorized', SESSION_EXPIRED));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EVALUATE_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(`${base}/api/bac/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(req),
        signal: controller.signal,
      });
    } catch {
      throw new BacApiError('grading_failed', controller.signal.aborted ? TIMEOUT : OFFLINE);
    }
    if (res.status === 401) return sessionExpired(new BacApiError('unauthorized', SESSION_EXPIRED));
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new BacApiError('grading_failed', controller.signal.aborted ? TIMEOUT : GRADING_FAILED);
    }
    if (!res.ok) {
      const e = body as Partial<BacSubmitError> | null;
      const error = new BacApiError(e?.error ?? 'grading_failed', e?.message || GRADING_FAILED, {
        required: e?.required,
        balance: e?.balance ?? e?.credits?.balance,
        credits: e?.credits,
      });
      if (res.status === 403 && error.code === 'suspended') return accountSuspended(error);
      if (res.status === 403 && error.code === 'access_required') await refreshRegisteredAccess();
      throw error;
    }
    return body as BacSubmitResponse;
  } finally {
    clearTimeout(timer);
  }
}

const filled = (s: string | null | undefined) => !!s && s.trim() !== '';

function isAnswered(item: BacItem, a: ExerciseAnswer | undefined): boolean {
  if (!a || a.type !== item.type) return false;
  switch (a.type) {
    case 'short_answer':
    case 'comparison':
    case 'argument':
      return filled(a.text);
    case 'multi_answer':
    case 'facts':
      return a.texts.some(filled);
    case 'source_info':
      return a.marks.length > 0;
    case 'source_letter':
      return a.letter != null;
    case 'cause_effect':
      return a.cause != null || a.effect != null;
    case 'viewpoint':
      return filled(a.text) || a.marks.length > 0;
    case 'essay': {
      if (item.type !== 'essay') return false;
      return item.requirements.length > 0 && item.requirements.every((r) => filled(a.parts?.[r.id]));
    }
  }
}

export function answeredCount(items: BacItem[], answers: BacAnswers): { answered: number; total: number; empty: BacItem[] } {
  const empty = items.filter((it) => !isAnswered(it, answers[it.id]));
  return { answered: items.length - empty.length, total: items.length, empty };
}
