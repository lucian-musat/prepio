// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TreeNode } from '@/lib/data/tree';
import TreeEditor from './TreeEditor';

const actions = vi.hoisted(() => {
  const ok = vi.fn(async () => ({ ok: true as const }));
  return {
    createLesson: ok, createNode: ok, deleteLesson: ok, deleteNode: ok, moveLesson: ok, moveNode: ok, renameNode: ok, setLessonStatus: ok,
  };
});
vi.mock('@/app/(admin)/actions/tree', () => actions);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const lesson = (id: string, status: 'draft' | 'published') => ({ id, node_id: 'n1', title: `Lecția ${id}`, position: 0, status });
const node = (lessons: ReturnType<typeof lesson>[], children: TreeNode[] = []): TreeNode => ({
  id: 'n1', parent_id: null, title: 'Tema', position: 0, children, lessons,
});

const hintOf = (btn: HTMLElement) => {
  const id = btn.getAttribute('aria-describedby');
  return id ? document.getElementById(id) : null;
};

describe('TreeEditor delete protection', () => {
  it('disables delete for a published lesson and shows the hint as visible text', () => {
    render(<TreeEditor tree={[node([lesson('p', 'published')])]} />);
    const btn = screen.getByRole('button', { name: 'Șterge lecția' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(hintOf(btn)?.textContent).toBe('Depublică lecția întâi');
  });

  it('keeps delete enabled for a draft lesson', () => {
    render(<TreeEditor tree={[node([lesson('d', 'draft')])]} />);
    const btn = screen.getByRole('button', { name: 'Șterge lecția' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(btn.getAttribute('aria-describedby')).toBeNull();
  });

  it('disables node delete when its subtree holds published lessons, counting nested ones', () => {
    const child: TreeNode = { id: 'n2', parent_id: 'n1', title: 'Sub', position: 0, children: [], lessons: [{ ...lesson('c', 'published'), node_id: 'n2' }] };
    render(<TreeEditor tree={[node([lesson('p', 'published'), lesson('d', 'draft')], [child])]} />);
    const [outer, inner] = screen.getAllByRole('button', { name: 'Șterge' }) as HTMLButtonElement[];
    expect(outer.disabled).toBe(true);
    expect(hintOf(outer)?.textContent).toBe('Conține lecții publicate (2). Depublică-le întâi');
    expect(hintOf(inner)?.textContent).toBe('Conține lecții publicate (1). Depublică-le întâi');
  });

  it('asks before unpublishing and calls setLessonStatus only after confirming', async () => {
    const user = userEvent.setup();
    render(<TreeEditor tree={[node([lesson('p', 'published')])]} />);
    await user.click(screen.getByRole('button', { name: 'Retrage' }));
    expect(screen.getByText('Retragi lecția din publicare? Elevii nu o vor mai vedea.')).toBeTruthy();
    expect(actions.setLessonStatus).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Retrage' }));
    expect(actions.setLessonStatus).toHaveBeenCalledWith('p', 'draft');
  });

  it('publishes without asking', async () => {
    const user = userEvent.setup();
    render(<TreeEditor tree={[node([lesson('d', 'draft')])]} />);
    await user.click(screen.getByRole('button', { name: 'Publică' }));
    expect(actions.setLessonStatus).toHaveBeenCalledWith('d', 'published');
  });

  it('warns about student progress in the lesson delete modal', async () => {
    const user = userEvent.setup();
    render(<TreeEditor tree={[node([lesson('d', 'draft')])]} />);
    await user.click(screen.getByRole('button', { name: 'Șterge lecția' }));
    expect(screen.getByTestId('confirm-text').textContent).toContain('Se șterg și progresul, încercările și consolidarea elevilor pe această lecție.');
  });
});
