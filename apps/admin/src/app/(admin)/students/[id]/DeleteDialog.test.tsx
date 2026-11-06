// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DeleteDialog from './DeleteDialog';

const actions = vi.hoisted(() => ({ deleteStudentAction: vi.fn() }));
vi.mock('../actions', () => actions);
const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

afterEach(() => {
  cleanup();
  actions.deleteStudentAction.mockReset();
  push.mockReset();
});

const base = { userId: 's1', email: 'elev@test.local', show: true, onHide: () => {} };

describe('DeleteDialog', () => {
  it('locks the block checkbox for a suspended student and prefills the reason', () => {
    render(<DeleteDialog {...base} suspended suspendedReason="Spam" />);
    expect(screen.getByText('Șterge contul')).toBeTruthy();
    expect(screen.getByText('Se șterg definitiv contul și toate datele elevului.')).toBeTruthy();
    const box = screen.getByLabelText('Blochează reînregistrarea cu acest email') as HTMLInputElement;
    expect(box.checked).toBe(true);
    expect(box.disabled).toBe(true);
    expect(screen.getByText('Elevul e suspendat: emailul se blochează automat.')).toBeTruthy();
    expect((screen.getByLabelText('Motiv (îl vede elevul dacă revine)') as HTMLTextAreaElement).value).toBe('Spam');
  });

  it('starts unchecked for an active student; the reason shows when ticked', async () => {
    const user = userEvent.setup();
    render(<DeleteDialog {...base} suspended={false} suspendedReason={null} />);
    const box = screen.getByLabelText('Blochează reînregistrarea cu acest email') as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(box.disabled).toBe(false);
    expect(screen.queryByText('Elevul e suspendat: emailul se blochează automat.')).toBeNull();
    expect(screen.queryByLabelText('Motiv (îl vede elevul dacă revine)')).toBeNull();
    await user.click(box);
    expect(screen.getByLabelText('Motiv (îl vede elevul dacă revine)')).toBeTruthy();
  });

  it('keeps the button disabled until the email matches, then deletes and goes back to the list', async () => {
    actions.deleteStudentAction.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<DeleteDialog {...base} suspended={false} suspendedReason={null} />);
    const button = screen.getByRole('button', { name: 'Șterge definitiv' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    const field = screen.getByLabelText('Scrie emailul elevului ca să confirmi');
    await user.type(field, 'elev@test.loca');
    expect(button.disabled).toBe(true);
    await user.type(field, 'l');
    expect(button.disabled).toBe(false);
    await user.click(button);
    await waitFor(() =>
      expect(actions.deleteStudentAction).toHaveBeenCalledWith('s1', { confirmEmail: 'elev@test.local', block: false, reason: '' }),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith('/students?notice=deleted'));
  });

  it('shows the error inline and stays', async () => {
    actions.deleteStudentAction.mockResolvedValue({ ok: false, error: 'Motivul este obligatoriu.' });
    const user = userEvent.setup();
    render(<DeleteDialog {...base} suspended={false} suspendedReason={null} />);
    await user.click(screen.getByLabelText('Blochează reînregistrarea cu acest email'));
    await user.type(screen.getByLabelText('Scrie emailul elevului ca să confirmi'), 'elev@test.local');
    await user.click(screen.getByRole('button', { name: 'Șterge definitiv' }));
    expect(await screen.findByText('Motivul este obligatoriu.')).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });
});
