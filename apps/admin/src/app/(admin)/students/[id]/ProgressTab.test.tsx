// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LessonProgressRow } from '@/lib/data/students';
import { NoticeProvider } from './Notice';
import ProgressTab from './ProgressTab';

const actions = vi.hoisted(() => ({ resetProgressAction: vi.fn() }));
vi.mock('../actions', () => actions);

afterEach(() => {
  cleanup();
  actions.resetProgressAction.mockReset();
});

const ROWS: LessonProgressRow[] = [
  { lessonId: 'l1', title: 'Unirea Principatelor', status: 'finished', where: 'Consolidare 10/10', lastActivityAt: '2026-11-03T10:00:00Z' },
  { lessonId: 'l2', title: 'Războiul de Independență', status: 'in_progress', where: 'Card 6 din 14', lastActivityAt: '2026-11-03T10:00:00Z' },
  { lessonId: 'l3', title: 'Marea Unire', status: 'not_started', where: '—', lastActivityAt: null },
];

const row = (t: string) => screen.getByRole('row', { name: new RegExp(t) });

describe('ProgressTab', () => {
  it('shows the status badges and a reset button on started lessons only', () => {
    render(<ProgressTab userId="s1" rows={ROWS} />);
    for (const h of ['Lecție', 'Stare', 'Unde a rămas', 'Ultima activitate']) {
      expect(screen.getByRole('columnheader', { name: h })).toBeTruthy();
    }
    expect(within(row('Unirea Principatelor')).getByText('Terminată').className).toContain('success');
    expect(within(row('Războiul')).getByText('În curs').className).toContain('warning');
    expect(within(row('Marea Unire')).getByText('Neîncepută').className).toContain('secondary');
    expect(within(row('Unirea Principatelor')).getByRole('button', { name: 'Resetează' })).toBeTruthy();
    expect(within(row('Războiul')).getByRole('button', { name: 'Resetează' })).toBeTruthy();
    expect(within(row('Marea Unire')).queryByRole('button', { name: 'Resetează' })).toBeNull();
  });

  it('confirms and resets one lesson', async () => {
    actions.resetProgressAction.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ProgressTab userId="s1" rows={ROWS} />);
    await user.click(within(row('Războiul')).getByRole('button', { name: 'Resetează' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Resetează parcursul' })).toBeTruthy();
    expect(dialog.textContent).toContain(
      'Resetezi lecția „Războiul de Independență”? Se șterg progresul și răspunsurile salvate ale elevului la această lecție. Creditele nu se schimbă.',
    );
    expect(within(dialog).getByRole('button', { name: 'Renunță' })).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Resetează' }));
    await waitFor(() => expect(actions.resetProgressAction).toHaveBeenCalledWith('s1', 'l2'));
  });

  it('reports success on the page after a reset and the alert can be dismissed', async () => {
    actions.resetProgressAction.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<NoticeProvider><ProgressTab userId="s1" rows={ROWS} /></NoticeProvider>);
    await user.click(within(row('Războiul')).getByRole('button', { name: 'Resetează' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Resetează' }));
    const status = await screen.findByRole('status');
    expect(status.textContent).toContain('Parcursul lecției „Războiul de Independență” a fost resetat.');
    await user.click(within(status).getByRole('button'));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the error inline', async () => {
    actions.resetProgressAction.mockResolvedValue({ ok: false, error: 'Elevul nu a fost găsit.' });
    const user = userEvent.setup();
    render(<ProgressTab userId="s1" rows={ROWS} />);
    await user.click(within(row('Unirea Principatelor')).getByRole('button', { name: 'Resetează' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Resetează' }));
    expect(await within(dialog).findByText('Elevul nu a fost găsit.')).toBeTruthy();
  });
});
