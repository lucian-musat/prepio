// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StudentEvent } from '@/lib/data/students';
import TimelineTab from './TimelineTab';

const actions = vi.hoisted(() => ({ loadMoreEventsAction: vi.fn() }));
vi.mock('../actions', () => actions);

afterEach(() => {
  cleanup();
  actions.loadMoreEventsAction.mockReset();
});

const ev = (id: number, label = `Eveniment ${id}`): StudentEvent => ({
  id, kind: 'app_opened', createdAt: '2026-11-06T16:40:00Z', label, details: null,
});

describe('TimelineTab', () => {
  it('shows the empty state', () => {
    render(<TimelineTab userId="s1" initial={[]} pageSize={50} />);
    expect(screen.getByText('Încă nu există activitate.')).toBeTruthy();
  });

  it('shows date, time and label without „Mai vechi” under 50 rows', () => {
    render(<TimelineTab userId="s1" initial={[ev(2, 'A intrat în aplicație'), ev(1)]} pageSize={50} />);
    expect(screen.getAllByText('6 nov, 18:40')).toHaveLength(2);
    expect(screen.getByText('A intrat în aplicație')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Mai vechi' })).toBeNull();
  });

  it('loads older events when 50 came back', async () => {
    const first = Array.from({ length: 50 }, (_, i) => ev(100 - i));
    actions.loadMoreEventsAction.mockResolvedValue({ ok: true, data: [ev(3, 'S-a înregistrat cu email')] });
    const user = userEvent.setup();
    render(<TimelineTab userId="s1" initial={first} pageSize={50} />);
    await user.click(screen.getByRole('button', { name: 'Mai vechi' }));
    await waitFor(() => expect(actions.loadMoreEventsAction).toHaveBeenCalledWith('s1', 51));
    expect(await screen.findByText('S-a înregistrat cu email')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Mai vechi' })).toBeNull();
  });
});
