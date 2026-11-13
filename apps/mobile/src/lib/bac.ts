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
  apiErrorText,
  bearerToken,
  EVALUATE_TIMEOUT_MS,
  missingApiUrl,
  offlineText,
  sessionExpiredText,
  sessionExpired,
} from './api';
import { ownUserId } from './ownUser';
import { refreshRegisteredAccess } from './profileRefresh';
import { apiUrl, getSupabase } from './supabase';
import { t } from '../texts/store';

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
  const userId = await ownUserId(client);
  const [subRes, attRes] = await Promise.all([
    client
      .from('bac_subjects')
      .select('id,title,year,variant,credit_cost,position')
      .eq('published', true)
      .order('year', { ascending: false })
      .order('position'),
    client.from('bac_attempts').select('subject_id,status,grade,position,graded_at').eq('user_id', userId),
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
  const userId = await ownUserId(client);
  const { data, error } = await client
    .from('bac_attempts')
    .select(ATTEMPT_COLUMNS)
    .eq('user_id', userId)
    .eq('subject_id', subjectId)
    .in('status', ['draft', 'grading', 'failed'])
    .maybeSingle();
  if (error) throw error;
  return data ? attemptView(data) : null;
}

/** The most recent graded attempt of a subject, if any. */
export async function fetchLatestGraded(subjectId: string, client: SupabaseClient = getSupabase()): Promise<BacAttemptView | null> {
  const userId = await ownUserId(client);
  const { data, error } = await client
    .from('bac_attempts')
    .select(ATTEMPT_COLUMNS)
    .eq('user_id', userId)
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
    super(t('errors.bac.draftLocked'));
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


export async function submitBac(req: BacSubmitRequest): Promise<BacSubmitResponse> {
  const base = apiUrl();
  if (!base) {
    missingApiUrl('submitBac');
    throw new BacApiError('grading_failed', t('errors.bac.notConfigured'));
  }
  const token = await bearerToken(() => new BacApiError('grading_failed', offlineText()));
  if (!token) return sessionExpired(new BacApiError('unauthorized', sessionExpiredText()));

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
      throw new BacApiError('grading_failed', controller.signal.aborted ? t('errors.bac.timeout') : offlineText());
    }
    if (res.status === 401) return sessionExpired(new BacApiError('unauthorized', sessionExpiredText()));
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new BacApiError('grading_failed', controller.signal.aborted ? t('errors.bac.timeout') : t('errors.api.bac.gradingFailed'));
    }
    if (!res.ok) {
      const e = body as Partial<BacSubmitError> | null;
      const code = e?.error ?? 'grading_failed';
      const error = new BacApiError(code, apiErrorText('bac', code), {
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

export type Completeness = 'empty' | 'partial' | 'complete';

/** `done` of `need` parts written: none is empty, all is complete, anything between is partial. */
const of = (done: number, need: number): Completeness => (done <= 0 ? 'empty' : done >= need ? 'complete' : 'partial');
const countOf = (item: BacItem) => Math.max(1, Number((item as { count?: number }).count ?? 1));

/** How much of a requirement is written, the way the grader will count it (every part it asks for). */
export function completeness(item: BacItem, a: ExerciseAnswer | undefined): Completeness {
  if (!a || a.type !== item.type) return 'empty';
  switch (a.type) {
    case 'short_answer':
    case 'comparison':
    case 'argument':
      return filled(a.text) ? 'complete' : 'empty';
    case 'multi_answer':
    case 'facts':
      return of(a.texts.filter(filled).length, countOf(item));
    case 'source_info':
      return of(a.marks.length, countOf(item));
    case 'source_letter':
      return a.letter != null ? 'complete' : 'empty';
    case 'cause_effect':
      return of(Number(a.cause != null) + Number(a.effect != null), 2);
    case 'viewpoint':
      return of(Number(filled(a.text)) + Math.min(a.marks.length, countOf(item)), 1 + countOf(item));
    case 'essay': {
      if (item.type !== 'essay' || item.requirements.length === 0) return 'empty';
      return of(item.requirements.filter((r) => filled(a.parts?.[r.id])).length, item.requirements.length);
    }
  }
}

/** Requirements answered completely, plus the ones left empty and the ones only partly written. */
export function answeredCount(
  items: BacItem[],
  answers: BacAnswers,
): { answered: number; total: number; empty: BacItem[]; partial: BacItem[] } {
  const state = items.map((it) => completeness(it, answers[it.id]));
  const empty = items.filter((_, i) => state[i] === 'empty');
  const partial = items.filter((_, i) => state[i] === 'partial');
  return { answered: items.length - empty.length - partial.length, total: items.length, empty, partial };
}
