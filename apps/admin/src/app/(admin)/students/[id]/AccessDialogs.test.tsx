// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GrantAccessDialog from './GrantAccessDialog';
import { NoticeProvider } from './Notice';
import RevokeAccessDialog from './RevokeAccessDialog';

const actions = vi.hoisted(() => ({ grantAccessAction: vi.fn(), revokeAccessAction: vi.fn() }));
vi.mock('../actions', () => actions);

afterEach(() => {
  cleanup();
  actions.grantAccessAction.mockReset();
  actions.revokeAccessAction.mockReset();
});

describe('GrantAccessDialog', () => {
  it('explains the effect and requires a reason', async () => {
    const user = userEvent.setup();
    render(<GrantAccessDialog userId="s1" show onHide={() => {}} />);
    expect(screen.getByText('Lunile se adaugă la accesul curent. Nu se adaugă credite.')).toBeTruthy();
    await user.type(screen.getByLabelText('Număr de luni'), '2');
    await user.type(screen.getByLabelText('Motiv'), '   ');
    await user.click(screen.getByRole('button', { name: 'Acordă acces' }));
    expect(await screen.findByText('Scrie motivul.')).toBeTruthy();
    expect(actions.grantAccessAction).not.toHaveBeenCalled();
  });

  it.each(['0', '25', '1.5', ''])('refuses "%s" months', async (months) => {
    const user = userEvent.setup();
    render(<GrantAccessDialog userId="s1" show onHide={() => {}} />);
    if (months) await user.type(screen.getByLabelText('Număr de luni'), months);
    await user.type(screen.getByLabelText('Motiv'), 'cadou');
    await user.click(screen.getByRole('button', { name: 'Acordă acces' }));
    expect(await screen.findByText('Alege între 1 și 24 de luni.')).toBeTruthy();
    expect(actions.grantAccessAction).not.toHaveBeenCalled();
  });

  it('grants, reports the end date and closes', async () => {
    actions.grantAccessAction.mockResolvedValue({ ok: true, data: '2027-02-08T10:00:00Z' });
    const onHide = vi.fn();
    const user = userEvent.setup();
    render(<NoticeProvider><GrantAccessDialog userId="s1" show onHide={onHide} /></NoticeProvider>);
    await user.type(screen.getByLabelText('Număr de luni'), '2');
    await user.type(screen.getByLabelText('Motiv'), 'Concurs');
    await user.click(screen.getByRole('button', { name: 'Acordă acces' }));
    await waitFor(() => expect(actions.grantAccessAction).toHaveBeenCalledWith('s1', 2, 'Concurs'));
    expect((await screen.findByRole('status')).textContent).toContain('Acces acordat până la 8 februarie 2027.');
    expect(onHide).toHaveBeenCalled();
  });

  it('shows a server error and stays open', async () => {
    actions.grantAccessAction.mockResolvedValue({ ok: false, error: 'Elevul nu mai există.' });
    const onHide = vi.fn();
    const user = userEvent.setup();
    render(<GrantAccessDialog userId="s1" show onHide={onHide} />);
    await user.type(screen.getByLabelText('Număr de luni'), '2');
    await user.type(screen.getByLabelText('Motiv'), 'x');
    await user.click(screen.getByRole('button', { name: 'Acordă acces' }));
    expect(await screen.findByText('Elevul nu mai există.')).toBeTruthy();
    expect(onHide).not.toHaveBeenCalled();
  });
});

describe('RevokeAccessDialog', () => {
  it('explains the effect and requires a reason', async () => {
    const user = userEvent.setup();
    render(<RevokeAccessDialog userId="s1" show onHide={() => {}} />);
    expect(screen.getByText('Elevul revine la trial acum. Creditele rămân.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Retrage accesul' }));
    expect(await screen.findByText('Scrie motivul.')).toBeTruthy();
    expect(actions.revokeAccessAction).not.toHaveBeenCalled();
  });

  it('revokes, reports and closes', async () => {
    actions.revokeAccessAction.mockResolvedValue({ ok: true });
    const onHide = vi.fn();
    const user = userEvent.setup();
    render(<NoticeProvider><RevokeAccessDialog userId="s1" show onHide={onHide} /></NoticeProvider>);
    await user.type(screen.getByLabelText('Motiv'), 'Abuz');
    await user.click(screen.getByRole('button', { name: 'Retrage accesul' }));
    await waitFor(() => expect(actions.revokeAccessAction).toHaveBeenCalledWith('s1', 'Abuz'));
    expect((await screen.findByRole('status')).textContent).toContain('Accesul a fost retras.');
    expect(onHide).toHaveBeenCalled();
  });
});
