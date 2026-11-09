import { describe, expect, it, vi } from 'vitest';
import { LEDGER_KIND_LABELS } from './studentLabels';
import {
  eventIcon, eventLabel, grantAccess, ledgerDetails, mergeOrders, orderLabel, orderStatusLabel, progressWhere, revokeAccess, type EventInput,
} from './students';

describe('orderStatusLabel', () => {
  it('an order approved without a payment provider is not shown as paid', () => {
    expect(orderStatusLabel({ status: 'approved', provider: 'none' })).toBe('Aprobată (fără plată)');
  });
  it('an order approved by a real provider is paid', () => {
    expect(orderStatusLabel({ status: 'approved', provider: 'stripe' })).toBe('Plătită');
  });
  it('pending, failed and unknown states', () => {
    expect(orderStatusLabel({ status: 'pending', provider: 'none' })).toBe('În așteptare');
    expect(orderStatusLabel({ status: 'failed', provider: 'stripe' })).toBe('Eșuată');
    expect(orderStatusLabel({ status: 'weird', provider: 'none' })).toBe('weird');
  });
});

const base = { finishedAt: null, position: null, cardsTotal: 8, runIndex: null, runTotal: null, runFinishedAt: null };

describe('progressWhere', () => {
  it('cards phase', () => {
    expect(progressWhere({ ...base, position: { phase: 'cards', index: 2 } })).toBe('Card 3 din 8');
  });
  it('questions phase', () => {
    expect(progressWhere({ ...base, position: { phase: 'questions', index: 0 } })).toBe('Verificare, întrebarea 1');
  });
  it('finished with no run', () => {
    expect(progressWhere({ ...base, finishedAt: '2026-01-01' })).toBe('Terminată');
  });
  it('a run in progress', () => {
    expect(progressWhere({ ...base, finishedAt: 'x', runIndex: 1, runTotal: 5 })).toBe('Consolidare 2/5');
  });
  it('a finished run', () => {
    expect(progressWhere({ ...base, finishedAt: 'x', runIndex: 4, runTotal: 5, runFinishedAt: 'y' })).toBe('Consolidare 5/5');
  });
  it('nothing', () => {
    expect(progressWhere(base)).toBe('—');
  });
});

describe('access orders', () => {
  const credit = { kind: 'credits' as const, id: 'c', credits: 20, priceBani: 999, status: 'approved', provider: 'none', createdAt: '2026-11-02T10:00:00Z', durationMonths: null, bonusCredits: null };
  const access = { kind: 'access' as const, id: 'a', credits: null, priceBani: 15000, status: 'approved', provider: 'none', createdAt: '2026-11-03T10:00:00Z', durationMonths: 3, bonusCredits: 100 };
  it('labels both kinds', () => {
    expect(orderLabel(access)).toBe('Acces 3 luni · +100 credite');
    expect(orderLabel({ ...access, durationMonths: 1, bonusCredits: 0 })).toBe('Acces 1 lună');
    expect(orderLabel(credit)).toBe('20 de credite');
  });
  it('merges newest first', () => {
    expect(mergeOrders([credit], [access]).map((o) => o.id)).toEqual(['a', 'c']);
    expect(mergeOrders([access], [credit]).map((o) => o.id)).toEqual(['a', 'c']);
  });
});

describe('ledger labels', () => {
  it('names the access bonus', () => {
    expect(LEDGER_KIND_LABELS.access_bonus).toBe('Credite incluse în acces');
  });
});

describe('grantAccess / revokeAccess', () => {
  const dbWith = (res: { data?: unknown; error?: { message: string } | null }) => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null, ...res });
    return { db: { rpc } as never, rpc };
  };
  it('grants and returns the new end date', async () => {
    const { db, rpc } = dbWith({ data: '2027-02-08T10:00:00+00:00' });
    expect(await grantAccess(db, 'u', 2, '  cadou ')).toBe('2027-02-08T10:00:00+00:00');
    expect(rpc).toHaveBeenCalledWith('admin_grant_access', { p_user: 'u', p_months: 2, p_reason: 'cadou' });
  });
  it('validates before calling the database', async () => {
    const { db, rpc } = dbWith({});
    await expect(grantAccess(db, 'u', 0, 'x')).rejects.toThrow('Alege între 1 și 24 de luni.');
    await expect(grantAccess(db, 'u', 25, 'x')).rejects.toThrow('Alege între 1 și 24 de luni.');
    await expect(grantAccess(db, 'u', 1.5, 'x')).rejects.toThrow('Alege între 1 și 24 de luni.');
    await expect(grantAccess(db, 'u', 2, '  ')).rejects.toThrow('Scrie motivul.');
    await expect(revokeAccess(db, 'u', '')).rejects.toThrow('Scrie motivul.');
    expect(rpc).not.toHaveBeenCalled();
  });
  it('maps database errors to Romanian', async () => {
    const cases: [string, string][] = [
      ['reason_required', 'Scrie motivul.'],
      ['bad_months', 'Alege între 1 și 24 de luni.'],
      ['not_active', 'Elevul nu are acces activ.'],
      ['cannot_target_admin', 'Nu poți modifica accesul unui administrator.'],
      ['student_not_found', 'Elevul nu mai există.'],
      ['forbidden', 'Nu ai drepturi de administrator.'],
    ];
    for (const [code, msg] of cases) {
      const { db } = dbWith({ error: { message: code } });
      await expect(revokeAccess(db, 'u', 'x')).rejects.toThrow(msg);
    }
  });
});

describe('eventLabel', () => {
  const ev = (kind: string, o: Partial<EventInput> = {}): string =>
    eventLabel({ kind, details: null, lessonTitle: null, exerciseType: null, adminEmail: null, ...o });
  it('account events', () => {
    expect(ev('registered', { details: { provider: 'google' } })).toBe('S-a înregistrat cu Google');
    expect(ev('registered', { details: { provider: 'email' } })).toBe('S-a înregistrat cu email');
    expect(ev('welcome_credits', { details: { credits: 12 } })).toBe('A primit 12 credite de bun venit');
    expect(ev('name_changed')).toBe('Și-a schimbat numele');
    expect(ev('mode_changed', { details: { mode: 'guided' } })).toBe('A ales modul Traseu ghidat');
    expect(ev('mode_changed', { details: { mode: 'free' } })).toBe('A ales modul Explorare liberă');
    expect(ev('app_opened')).toBe('A intrat în aplicație');
  });
  it('lesson events', () => {
    expect(ev('lesson_started', { lessonTitle: 'Fotosinteza' })).toBe('A început lecția „Fotosinteza”');
    expect(ev('lesson_finished', { lessonTitle: 'F' })).toBe('A terminat lecția „F”');
    expect(ev('test_failed', { lessonTitle: 'F' })).toBe('Nu a trecut testul lecției „F”');
    expect(ev('consolidation_started', { lessonTitle: 'F' })).toBe('A început consolidarea „F”');
    expect(ev('consolidation_finished', { lessonTitle: 'F' })).toBe('A terminat consolidarea „F”');
  });
  it('a deleted lesson', () => {
    expect(ev('lesson_started')).toBe('A început lecția (lecție ștearsă)');
  });
  it('credit events', () => {
    expect(ev('check', { details: { cost: 2, target: 'a' }, exerciseType: 'cause_effect' })).toBe(
      'Verificare cu profesorul digital · Cauză-efect · −2',
    );
    expect(ev('check_refunded', { details: { credits: 2 } })).toBe('Verificare nereușită · credite returnate');
    expect(ev('check_blocked', { details: { required: 2, balance: 1 } })).toBe('Verificare blocată · avea 1, trebuiau 2');
    expect(ev('purchase', { details: { credits: 20 } })).toBe('A cumpărat 20 de credite');
    expect(ev('credits_adjusted', { details: { delta: 5, reason: 'bonus' }, adminEmail: 'a@x.ro' })).toBe('a@x.ro: credite +5 · bonus');
    expect(ev('credits_adjusted', { details: { delta: -3, reason: 'r' }, adminEmail: 'a@x.ro' })).toBe('a@x.ro: credite −3 · r');
  });
  it('BAC events', () => {
    const t = { subjectTitle: 'Subiect 2025' };
    expect(ev('bac_started', t)).toBe('Subiect BAC început · Subiect 2025');
    expect(ev('bac_submitted', { ...t, details: { subject_id: 's', cost: 10 } })).toBe('Lucrare trimisă la corectat · Subiect 2025 · 🪙 10');
    expect(ev('bac_graded', { ...t, details: { subject_id: 's', points: 74, grade: 8.4 } })).toBe('Lucrare corectată · Subiect 2025 · nota 8,40');
    expect(ev('bac_grading_failed', t)).toBe('Corectare nereușită · returnat');
    expect(ev('bac_started')).toBe('Subiect BAC început · (subiect șters)');
    expect(eventIcon('bac_started', null)).toBe('📝');
    expect(eventIcon('bac_submitted', null)).toBe('📤');
    expect(eventIcon('bac_graded', null)).toBe('🎓');
    expect(eventIcon('bac_grading_failed', null)).toBe('⚠️');
  });
  it('ledger rows of a BAC target name the subject', () => {
    const row = { kind: 'check', target: 'bac:5b3a1d0e-4c7f-4a55-9d3e-0f1a2b3c4d5e', reason: null, adminEmail: null, exerciseType: null, exercisePrompt: null, bacSubjectTitle: 'Subiect 2025' };
    expect(ledgerDetails(row)).toBe('Corectare subiect · Subiect 2025');
    expect(ledgerDetails({ ...row, kind: 'refund' })).toBe('Corectare subiect · Subiect 2025');
    expect(ledgerDetails({ ...row, bacSubjectTitle: null })).toBe('Corectare subiect · (subiect șters)');
    expect(ledgerDetails({ ...row, target: null, bacSubjectTitle: null })).toBe('');
  });
  it('access events', () => {
    expect(ev('access_purchased', { details: { months: 3, until: 'x', price_bani: 15000, credits: 100 } })).toBe('Acces cumpărat · 3 luni · 150,00 lei');
    expect(ev('access_granted', { details: { months: 2, until: 'x', reason: 'cadou' }, adminEmail: 'a@x.ro' })).toBe(
      'a@x.ro: acces acordat · 2 luni · Motiv: „cadou”',
    );
    expect(ev('access_granted', { details: { months: 1, reason: 'r' } })).toBe('Admin: acces acordat · 1 lună · Motiv: „r”');
    expect(ev('access_revoked', { details: { reason: 'abuz' }, adminEmail: 'a@x.ro' })).toBe('a@x.ro: acces retras · Motiv: „abuz”');
    expect(ev('access_expired', { details: { until: 'x' } })).toBe('Accesul a expirat');
    expect(ev('check_blocked', { details: { reason: 'access_required', cost: 2 } })).toBe('Verificare refuzată · lecție fără acces');
  });
  it('icons', () => {
    expect(eventIcon('access_purchased', null)).toBe('⭐');
    expect(eventIcon('access_granted', null)).toBe('🎟️');
    expect(eventIcon('access_revoked', null)).toBe('⛔');
    expect(eventIcon('access_expired', null)).toBe('⌛');
    expect(eventIcon('check_blocked', { reason: 'access_required' })).toBe('🚫');
    expect(eventIcon('check_blocked', { required: 2 })).toBeUndefined();
  });
  it('admin actions and system suspension', () => {
    expect(ev('suspended', { details: { reason: 'spam' }, adminEmail: 'a@x.ro' })).toBe('a@x.ro: cont suspendat · „spam”');
    expect(ev('suspended', { details: { reason: 'spam', blocked: true } })).toBe(
      'Sistem (reînregistrare blocată): cont suspendat · „spam”',
    );
    expect(ev('reactivated', { adminEmail: 'a@x.ro' })).toBe('a@x.ro: cont reactivat');
    expect(ev('progress_reset', { details: { scope: 'all' }, adminEmail: 'a@x.ro' })).toBe('a@x.ro: parcurs resetat · toate lecțiile');
    expect(ev('progress_reset', { details: { scope: 'lesson' }, adminEmail: 'a@x.ro', lessonTitle: 'F' })).toBe(
      'a@x.ro: parcurs resetat · lecția „F”',
    );
    expect(ev('progress_reset', { details: { scope: 'lesson' }, adminEmail: 'a@x.ro' })).toBe(
      'a@x.ro: parcurs resetat · lecția (lecție ștearsă)',
    );
  });
});
