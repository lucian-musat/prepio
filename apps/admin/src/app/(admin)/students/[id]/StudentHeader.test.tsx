// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { formatAccessDate } from '@prepio/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StudentRow } from '@/lib/data/students';
import { NoticeProvider } from './Notice';
import StudentHeader from './StudentHeader';

const reset = vi.hoisted(() => vi.fn());
vi.mock('../actions', () => ({
  adjustCreditsAction: vi.fn(), suspendStudentAction: vi.fn(), reactivateStudentAction: vi.fn(),
  resetProgressAction: reset, deleteStudentAction: vi.fn(), grantAccessAction: vi.fn(), revokeAccessAction: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

afterEach(cleanup);

const ACTIVE: StudentRow = {
  id: 's1', displayName: 'Madalin Anghel', email: 'madalin@gmail.com', creditBalance: 12, createdAt: '2026-11-04T10:00:00Z',
  provider: 'google', suspendedAt: null, suspendedReason: null, reregistrationBlocked: false,
  lastActivityAt: '2026-11-01T08:12:00Z', lessonsFinished: 2, accessUntil: null, isAdmin: false,
};

describe('StudentHeader', () => {
  it('shows an active student with numbers and actions', () => {
    render(<StudentHeader student={ACTIVE} lessonsTotal={5} mode="guided" suspendedBy={null} />);
    expect(screen.getByRole('heading', { name: 'Madalin Anghel' })).toBeTruthy();
    expect(screen.getByText('MA')).toBeTruthy();
    expect(screen.getByText('Activ')).toBeTruthy();
    expect(screen.getByText('madalin@gmail.com · Google · înregistrat 4 nov 2026 · ultima activitate 1 nov 2026')).toBeTruthy();
    expect(screen.getByTestId('lessons-finished').textContent).toBe('2 / 5');
    expect(screen.getByTestId('balance').textContent).toBe('12');
    expect(screen.getByText('Traseu ghidat')).toBeTruthy();
    for (const name of ['Ajustează credite', 'Resetează tot parcursul', 'Suspendă', 'Șterge contul']) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
    expect(screen.queryByRole('button', { name: 'Reactivează' })).toBeNull();
    expect(screen.queryByText(/Suspendat de/)).toBeNull();
  });

  it('resetting the whole path reports success on the page', async () => {
    reset.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<NoticeProvider><StudentHeader student={ACTIVE} lessonsTotal={5} mode="guided" suspendedBy={null} /></NoticeProvider>);
    await user.click(screen.getByRole('button', { name: 'Resetează tot parcursul' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Resetează parcursul' })).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Resetează' }));
    expect((await screen.findByRole('status')).textContent).toContain('Tot parcursul a fost resetat.');
    expect(reset).toHaveBeenCalledWith('s1', null);
  });

  it('shows a suspended student with the strip and Reactivează', () => {
    render(
      <StudentHeader
        student={{ ...ACTIVE, displayName: null, suspendedAt: '2026-11-06T16:40:00Z', suspendedReason: 'Spam', reregistrationBlocked: true }}
        lessonsTotal={5}
        mode={null}
        suspendedBy={null}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Fără nume' })).toBeTruthy();
    expect(screen.getByText('Suspendat')).toBeTruthy();
    expect(screen.getByText('Reînregistrare blocată')).toBeTruthy();
    expect(screen.getByText('Suspendat de sistem pe 6 nov 2026 · Motiv: „Spam”')).toBeTruthy();
    expect(screen.getByTestId('mode').textContent).toBe('—');
    expect(screen.getByRole('button', { name: 'Reactivează' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Suspendă' })).toBeNull();
  });

  it('names the admin who suspended', () => {
    render(
      <StudentHeader
        student={{ ...ACTIVE, suspendedAt: '2026-11-06T16:40:00Z', suspendedReason: 'x' }}
        lessonsTotal={5}
        mode="free"
        suspendedBy="admin@prepio.local"
      />,
    );
    expect(screen.getByText('Suspendat de admin@prepio.local pe 6 nov 2026 · Motiv: „x”')).toBeTruthy();
    expect(screen.getByText('Explorare liberă')).toBeTruthy();
  });

  it('shows Trial and only Acordă acces without full access', () => {
    render(<StudentHeader student={ACTIVE} lessonsTotal={5} mode="guided" suspendedBy={null} />);
    expect(screen.getByTestId('plan').textContent).toBe('Trial');
    expect(screen.getByRole('button', { name: 'Acordă acces' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Retrage accesul' })).toBeNull();
  });

  it('shows the end date and Retrage accesul with full access', async () => {
    const until = new Date(Date.now() + 90 * 86_400_000);
    render(<StudentHeader student={{ ...ACTIVE, accessUntil: until.toISOString() }} lessonsTotal={5} mode="guided" suspendedBy={null} />);
    expect(screen.getByTestId('plan').textContent).toMatch(/^Acces până la \d{1,2} \p{L}+ \d{4}$/u);
    expect(screen.getByRole('button', { name: 'Acordă acces' })).toBeTruthy();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retrage accesul' }));
    expect(await screen.findByRole('heading', { name: 'Retrage accesul' })).toBeTruthy();
  });

  it('shows Expirat pe and no Retrage accesul once access has ended', () => {
    const until = new Date(Date.now() - 3 * 86_400_000);
    render(<StudentHeader student={{ ...ACTIVE, accessUntil: until.toISOString() }} lessonsTotal={5} mode="guided" suspendedBy={null} />);
    expect(screen.getByTestId('plan').textContent).toMatch(/^Expirat pe \d{1,2} \p{L}+ \d{4}$/u);
    expect(screen.getByRole('button', { name: 'Acordă acces' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Retrage accesul' })).toBeNull();
  });

  it('shows an admin read-only: badge, plan Admin, no account actions', () => {
    render(<StudentHeader student={{ ...ACTIVE, isAdmin: true }} lessonsTotal={5} mode="guided" suspendedBy={null} />);
    expect(screen.getByTestId('admin-badge').textContent).toBe('Admin');
    expect(screen.getByTestId('plan').textContent).toBe('Admin');
    expect(screen.getByText('Cont de administrator: acțiunile asupra contului nu sunt disponibile.')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('shows no admin badge for a student', () => {
    render(<StudentHeader student={ACTIVE} lessonsTotal={5} mode="guided" suspendedBy={null} />);
    expect(screen.queryByTestId('admin-badge')).toBeNull();
  });

  it('opens the grant dialog', async () => {
    render(<StudentHeader student={ACTIVE} lessonsTotal={5} mode="guided" suspendedBy={null} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Acordă acces' }));
    expect(await screen.findByRole('heading', { name: 'Acordă acces' })).toBeTruthy();
  });
});

describe('StudentHeader access source', () => {
  const until = '2027-02-08T10:00:00Z';
  const untilText = formatAccessDate(new Date(until));
  const withSource = (kind: 'trial' | 'purchase' | 'referral_reward' | 'admin_grant') =>
    render(
      <StudentHeader
        student={{ ...ACTIVE, accessUntil: kind === 'trial' ? null : until }}
        lessonsTotal={5} mode={null} suspendedBy={null}
        accessSource={{ kind, at: kind === 'trial' ? null : '2026-11-01T10:00:00Z' }}
      />,
    );
  it.each([
    ['purchase', 'Acces: Plătit · până la'],
    ['admin_grant', 'Acces: Acordat manual · până la'],
    ['referral_reward', 'Acces: Recomandări · până la'],
    ['trial', 'Acces: Trial'],
  ] as const)('%s', (kind, text) => {
    withSource(kind);
    expect(screen.getByTestId('access-source').textContent).toContain(kind === 'trial' ? text : `${text} ${untilText}`);
    cleanup();
  });
  it('points to the Recomandări tab for a referral reward', () => {
    withSource('referral_reward');
    expect(screen.getByRole('link', { name: 'vezi Recomandări' }).getAttribute('href')).toBe('/students/s1?tab=recomandari');
  });
  it('renders no line without the prop', () => {
    render(<StudentHeader student={ACTIVE} lessonsTotal={5} mode={null} suspendedBy={null} />);
    expect(screen.queryByTestId('access-source')).toBeNull();
  });
});
