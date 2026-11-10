// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LessonHeader from './LessonHeader';

const setLessonStatus = vi.hoisted(() => vi.fn(async () => ({ ok: true as const })));
vi.mock('@/app/(admin)/actions/tree', () => ({ setLessonStatus }));
vi.mock('@/app/(admin)/lessons/[id]/actions', () => ({ updateLesson: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('LessonHeader', () => {
  it('asks before unpublishing; cancel keeps it published', async () => {
    const user = userEvent.setup();
    render(<LessonHeader id="l1" title="T" status="published" />);
    await user.click(screen.getByRole('button', { name: 'Retrage' }));
    expect(screen.getByText('Retragi lecția din publicare? Elevii nu o vor mai vedea.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Anulează' }));
    expect(setLessonStatus).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Retrage' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Retrage' }));
    expect(setLessonStatus).toHaveBeenCalledWith('l1', 'draft');
  });

  it('publishes without asking', async () => {
    const user = userEvent.setup();
    render(<LessonHeader id="l1" title="T" status="draft" />);
    await user.click(screen.getByRole('button', { name: 'Publică' }));
    expect(setLessonStatus).toHaveBeenCalledWith('l1', 'published');
  });
});
