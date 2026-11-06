// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StudentRow } from '@/lib/data/students';
import StudentHeader from './StudentHeader';

vi.mock('../actions', () => ({
  adjustCreditsAction: vi.fn(), suspendStudentAction: vi.fn(), reactivateStudentAction: vi.fn(),
  resetProgressAction: vi.fn(), deleteStudentAction: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

afterEach(cleanup);

const ACTIVE: StudentRow = {
  id: 's1', displayName: 'Madalin Anghel', email: 'madalin@gmail.com', creditBalance: 12, createdAt: '2026-11-04T10:00:00Z',
  provider: 'google', suspendedAt: null, suspendedReason: null, reregistrationBlocked: false,
  lastActivityAt: '2026-11-01T08:12:00Z', lessonsFinished: 2,
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
});
