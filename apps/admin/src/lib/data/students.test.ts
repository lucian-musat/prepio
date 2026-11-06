import { describe, expect, it } from 'vitest';
import { eventLabel, orderStatusLabel, progressWhere, type EventInput } from './students';

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
