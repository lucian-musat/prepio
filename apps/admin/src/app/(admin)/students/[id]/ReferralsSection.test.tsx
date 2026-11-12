// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { AdminReferralRow } from '@/lib/data/referrals';
import ReferralsSection from './ReferralsSection';

afterEach(cleanup);

const row = (over: Partial<AdminReferralRow>): AdminReferralRow => ({
  id: 'r', firstName: 'Ion', email: 'ion@x.ro', state: 'registered', createdAt: '2026-11-04T10:00:00Z',
  firstPaidAt: null, rewardCredits: null, accountDeleted: false, ...over,
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
    expect(within(rows[3]).getByText('Abonat · +40 credite')).toBeTruthy();
    expect(within(rows[1]).getByText(/în așteptare/)).toBeTruthy();
    expect(within(rows[4]).getByText(/limită atinsă/)).toBeTruthy();
    expect(within(rows[5]).getByText(/erau oprite/)).toBeTruthy();
    expect(within(rows[1]).getByText(/5 nov.? 2026/)).toBeTruthy();
  });

  it('marks a deleted account instead of an e-mail', () => {
    render(<ReferralsSection code={null} invitedBy={null} invitees={[row({ email: null, accountDeleted: true })]} />);
    expect(screen.getByText('cont șters').className).toContain('text-muted');
    expect(screen.queryByText(/Invitat de/)).toBeNull();
    expect(screen.getByTestId('referral-code').textContent).toBe('—');
  });

  it('shows the empty state', () => {
    render(<ReferralsSection code="ABCD2345" invitedBy={null} invitees={[]} />);
    expect(screen.getByText('Nu a invitat pe nimeni.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
