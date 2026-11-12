// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReferralsForm from './ReferralsForm';

const actions = vi.hoisted(() => ({ saveReferralSettings: vi.fn() }));
vi.mock('./actions', () => actions);

afterEach(() => {
  cleanup();
  actions.saveReferralSettings.mockReset();
});

const INITIAL = { enabled: false, threshold: 5, creditsPerInvitee: 40, maxRewarded: 100 };
const save = () => screen.getByRole('button', { name: 'Salvează recomandările' });

describe('ReferralsForm', () => {
  it('shows the current values and the access duration', () => {
    render(<ReferralsForm initial={INITIAL} durationMonths={3} bonusCredits={100} />);
    expect((screen.getByLabelText('Recomandări active') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText('Invitați pentru acces gratuit') as HTMLInputElement).value).toBe('5');
    expect((screen.getByLabelText('Credite pe invitat (cu acces activ)') as HTMLInputElement).value).toBe('40');
    expect((screen.getByLabelText('Limită de invitați recompensați per elev') as HTMLInputElement).value).toBe('100');
    expect(screen.getByText('Accesul gratuit are durata și creditele bonus de la Acces (acum 3 luni, +100 de credite).')).toBeTruthy();
  });

  it('names a free access without bonus credits when Acces has none', () => {
    render(<ReferralsForm initial={INITIAL} durationMonths={1} bonusCredits={0} />);
    expect(screen.getByText('Accesul gratuit are durata și creditele bonus de la Acces (acum o lună, fără credite bonus).')).toBeTruthy();
  });

  it('toggling the switch saves with the right payload', async () => {
    const user = userEvent.setup();
    actions.saveReferralSettings.mockResolvedValue({ ok: true });
    render(<ReferralsForm initial={INITIAL} durationMonths={3} bonusCredits={100} />);
    await user.click(screen.getByLabelText('Recomandări active'));
    await user.click(save());
    await waitFor(() => expect(actions.saveReferralSettings).toHaveBeenCalledTimes(1));
    expect(actions.saveReferralSettings).toHaveBeenCalledWith({ enabled: true, threshold: 5, creditsPerInvitee: 40, maxRewarded: 100 });
    expect(await screen.findByText('Setările recomandărilor au fost salvate.')).toBeTruthy();
  });

  it('editing a field after a successful save clears the saved status', async () => {
    const user = userEvent.setup();
    actions.saveReferralSettings.mockResolvedValue({ ok: true });
    render(<ReferralsForm initial={INITIAL} durationMonths={3} bonusCredits={100} />);
    await user.click(save());
    expect(await screen.findByText('Setările recomandărilor au fost salvate.')).toBeTruthy();
    await user.type(screen.getByLabelText('Invitați pentru acces gratuit'), '1');
    expect(screen.queryByText('Setările recomandărilor au fost salvate.')).toBeNull();
  });

  it('blocks invalid input with the message', async () => {
    const user = userEvent.setup();
    render(<ReferralsForm initial={INITIAL} durationMonths={3} bonusCredits={100} />);
    const t = screen.getByLabelText('Invitați pentru acces gratuit');
    await user.clear(t);
    await user.type(t, '101');
    await user.click(save());
    expect(actions.saveReferralSettings).not.toHaveBeenCalled();
    expect(await screen.findByText('Numărul de invitați trebuie să fie un număr întreg între 1 și 100.')).toBeTruthy();
  });

  it('blocks an empty field', async () => {
    const user = userEvent.setup();
    render(<ReferralsForm initial={INITIAL} durationMonths={3} bonusCredits={100} />);
    await user.clear(screen.getByLabelText('Limită de invitați recompensați per elev'));
    await user.click(save());
    expect(actions.saveReferralSettings).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('shows a server error and no saved confirmation', async () => {
    const user = userEvent.setup();
    actions.saveReferralSettings.mockResolvedValue({ ok: false, error: 'Setările recomandărilor nu au putut fi salvate. Încearcă din nou.' });
    render(<ReferralsForm initial={INITIAL} durationMonths={3} bonusCredits={100} />);
    await user.click(save());
    expect(await screen.findByText('Setările recomandărilor nu au putut fi salvate. Încearcă din nou.')).toBeTruthy();
    expect(screen.queryByText('Setările recomandărilor au fost salvate.')).toBeNull();
  });
});
