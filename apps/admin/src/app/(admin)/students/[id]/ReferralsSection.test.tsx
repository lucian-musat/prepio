// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { AdminReferralRow } from '@/lib/data/referrals';
import ReferralsSection from './ReferralsSection';

afterEach(cleanup);

const dateFmt = new Intl.DateTimeFormat('ro-RO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Bucharest' });

const row = (over: Partial<AdminReferralRow>): AdminReferralRow => ({
  id: 'r', firstName: 'Ion', email: 'ion@x.ro', state: 'registered', createdAt: '2026-11-04T10:00:00Z',
  firstPaidAt: null, rewardCredits: null, accountDeleted: false, accessLedgerId: null, ...over,
});

describe('ReferralsSection', () => {
  it('shows the code, the inviter link and every state', () => {
    const states: AdminReferralRow[] = [
      row({ id: '1', firstName: 'Ana', state: 'registered' }),
      row({ id: '2', firstName: 'Bia', state: 'pending', firstPaidAt: '2026-11-05T10:00:00Z' }),
      row({ id: '3', firstName: 'Cip', state: 'consumed_access', firstPaidAt: '2026-11-05T10:00:00Z' }),
      row({ id: '4', firstName: 'Dan', state: 'converted_credits', rewardCredits: 40, firstPaidAt: '2026-11-05T10:00:00Z' }),
      row({ id: '5', firstName: 'Eva', state: 'over_cap' }),
      row({ id: '6', firstName: 'Fan', state: 'not_rewarded_disabled' }),
    ];
    render(<ReferralsSection code="ABCD2345" invitedBy={{ id: 'u9', name: 'Maria' }} invitees={states} />);
    expect(screen.getByTestId('referral-code').textContent).toBe('ABCD2345');
    const link = screen.getByRole('link', { name: 'Maria' });
    expect(link.getAttribute('href')).toBe('/students/u9');
    expect(screen.getByText(/Invitat de/)).toBeTruthy();
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(6);
    expect(within(rows[0]).getByText('Ana')).toBeTruthy();
    expect(within(rows[0]).getByText('ion@x.ro')).toBeTruthy();
    expect(within(rows[0]).getByText('Cont creat, fără abonament')).toBeTruthy();
    expect(within(rows[0]).getByText('—')).toBeTruthy();
    expect(within(rows[3]).getByText('Abonat · +40 de credite')).toBeTruthy();
    expect(within(rows[1]).getByText(/în așteptare/)).toBeTruthy();
    expect(within(rows[4]).getByText(/limită atinsă/)).toBeTruthy();
    expect(within(rows[5]).getByText(/erau oprite/)).toBeTruthy();
    expect(within(rows[1]).getByText(dateFmt.format(new Date('2026-11-05T10:00:00Z')))).toBeTruthy();
  });

  it('marks a deleted account instead of an e-mail', () => {
    render(<ReferralsSection code={null} invitedBy={null} invitees={[row({ email: null, accountDeleted: true })]} />);
    expect(screen.getByText('cont șters').className).toContain('text-muted');
    expect(screen.queryByText(/Invitat de/)).toBeNull();
    expect(screen.getByTestId('referral-code').textContent).toBe('—');
  });

  it('shows an error note instead of the list when the data could not be loaded', () => {
    render(<ReferralsSection code={null} invitedBy={null} invitees={[]} failed />);
    expect(screen.getByRole('alert').textContent).toBe('Recomandările nu au putut fi încărcate.');
    expect(screen.queryByText('Nu a invitat pe nimeni.')).toBeNull();
  });

  it('names and marks the invitees that earned the current free access', () => {
    const invitees = [
      row({ id: '1', firstName: 'Ana', state: 'consumed_access', accessLedgerId: 7 }),
      row({ id: '2', firstName: 'Bia', state: 'consumed_access', accessLedgerId: 3 }),
      row({ id: '3', firstName: 'Cip', state: 'consumed_access', accessLedgerId: 7 }),
    ];
    render(<ReferralsSection code="ABCD2345" invitedBy={null} invitees={invitees} currentGrantId={7} />);
    expect(screen.getByText('Au contribuit la accesul curent: Ana, Cip')).toBeTruthy();
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('acces curent')).toBeTruthy();
    expect(within(rows[1]).queryByText('acces curent')).toBeNull();
    expect(within(rows[2]).getByText('acces curent')).toBeTruthy();
  });

  it('shows no contributors note without a current free access', () => {
    render(<ReferralsSection code="ABCD2345" invitedBy={null} invitees={[row({ state: 'consumed_access', accessLedgerId: 7 })]} currentGrantId={null} />);
    expect(screen.queryByText(/Au contribuit/)).toBeNull();
    expect(screen.queryByText('acces curent')).toBeNull();
  });

  it('shows the empty state', () => {
    render(<ReferralsSection code="ABCD2345" invitedBy={null} invitees={[]} />);
    expect(screen.getByText('Nu a invitat pe nimeni.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
