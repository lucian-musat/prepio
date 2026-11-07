// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NoticeProvider } from './Notice';
import SuspendDialog, { ReactivateDialog } from './SuspendDialog';

const actions = vi.hoisted(() => ({ suspendStudentAction: vi.fn(), reactivateStudentAction: vi.fn() }));
vi.mock('../actions', () => actions);

afterEach(() => {
  cleanup();
  actions.suspendStudentAction.mockReset();
  actions.reactivateStudentAction.mockReset();
});

describe('SuspendDialog', () => {
  it('requires a reason', async () => {
    const user = userEvent.setup();
    render(<SuspendDialog userId="s1" show onHide={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Suspendă contul' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Renunță' })).toBeTruthy();
    await user.type(screen.getByLabelText('Motiv (îl vede elevul)'), '   ');
    await user.click(screen.getByRole('button', { name: 'Suspendă' }));
    expect(await screen.findByText('Motivul este obligatoriu.')).toBeTruthy();
    expect(actions.suspendStudentAction).not.toHaveBeenCalled();
  });

  it('suspends with the reason and closes', async () => {
    actions.suspendStudentAction.mockResolvedValue({ ok: true });
    const onHide = vi.fn();
    const user = userEvent.setup();
    render(<SuspendDialog userId="s1" show onHide={onHide} />);
    await user.type(screen.getByLabelText('Motiv (îl vede elevul)'), 'Cont creat pentru test.');
    await user.click(screen.getByRole('button', { name: 'Suspendă' }));
    await waitFor(() => expect(actions.suspendStudentAction).toHaveBeenCalledWith('s1', 'Cont creat pentru test.'));
    await waitFor(() => expect(onHide).toHaveBeenCalled());
  });
});

describe('success notices', () => {
  it('suspend reports success on the page', async () => {
    actions.suspendStudentAction.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<NoticeProvider><SuspendDialog userId="s1" show onHide={() => {}} /></NoticeProvider>);
    await user.type(screen.getByLabelText('Motiv (îl vede elevul)'), 'Spam');
    await user.click(screen.getByRole('button', { name: 'Suspendă' }));
    expect((await screen.findByRole('status')).textContent).toContain('Contul a fost suspendat.');
  });

  it('reactivate reports success on the page', async () => {
    actions.reactivateStudentAction.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<NoticeProvider><ReactivateDialog userId="s1" blocked={false} show onHide={() => {}} /></NoticeProvider>);
    await user.click(screen.getByRole('button', { name: 'Reactivează' }));
    expect((await screen.findByRole('status')).textContent).toContain('Contul a fost reactivat.');
  });
});

describe('ReactivateDialog', () => {
  it('has a title', () => {
    render(<ReactivateDialog userId="s1" blocked={false} show onHide={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Reactivează contul' })).toBeTruthy();
  });

  it('mentions the email block only when blocked', () => {
    const { rerender } = render(<ReactivateDialog userId="s1" blocked={false} show onHide={() => {}} />);
    expect(screen.getByText('Reactivezi contul? Elevul își recapătă accesul imediat.')).toBeTruthy();
    rerender(<ReactivateDialog userId="s1" blocked show onHide={() => {}} />);
    expect(
      screen.getByText('Reactivezi contul? Elevul își recapătă accesul imediat. Emailul nu va mai fi blocat la reînregistrare.'),
    ).toBeTruthy();
  });

  it('reactivates and closes', async () => {
    actions.reactivateStudentAction.mockResolvedValue({ ok: true });
    const onHide = vi.fn();
    const user = userEvent.setup();
    render(<ReactivateDialog userId="s1" blocked={false} show onHide={onHide} />);
    await user.click(screen.getByRole('button', { name: 'Reactivează' }));
    await waitFor(() => expect(actions.reactivateStudentAction).toHaveBeenCalledWith('s1'));
    await waitFor(() => expect(onHide).toHaveBeenCalled());
  });
});
