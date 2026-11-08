// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AccessForm from './AccessForm';

const actions = vi.hoisted(() => ({ saveAccessSettings: vi.fn() }));
vi.mock('./actions', () => actions);

afterEach(() => {
  cleanup();
  actions.saveAccessSettings.mockReset();
});

const INITIAL = { priceBani: 15000, bonusCredits: 100, durationMonths: 3 };

describe('AccessForm', () => {
  it('loads the current offer and explains it applies to future payments', () => {
    render(<AccessForm initial={INITIAL} />);
    expect((screen.getByLabelText('Preț acces (lei)') as HTMLInputElement).value).toBe('150,00');
    expect((screen.getByLabelText('Credite incluse') as HTMLInputElement).value).toBe('100');
    expect((screen.getByLabelText('Durată (luni)') as HTMLInputElement).value).toBe('3');
    expect(screen.getByText('Modificările se aplică doar plăților viitoare.')).toBeTruthy();
  });

  it('blocks a zero price', async () => {
    const user = userEvent.setup();
    render(<AccessForm initial={INITIAL} />);
    const price = screen.getByLabelText('Preț acces (lei)');
    await user.clear(price);
    await user.type(price, '0');
    await user.click(screen.getByRole('button', { name: 'Salvează accesul' }));
    expect(actions.saveAccessSettings).not.toHaveBeenCalled();
    expect(await screen.findByText('Prețul trebuie să fie mai mare de 0.')).toBeTruthy();
  });

  it('blocks 25 months', async () => {
    const user = userEvent.setup();
    render(<AccessForm initial={INITIAL} />);
    const months = screen.getByLabelText('Durată (luni)');
    await user.clear(months);
    await user.type(months, '25');
    await user.click(screen.getByRole('button', { name: 'Salvează accesul' }));
    expect(actions.saveAccessSettings).not.toHaveBeenCalled();
    expect(await screen.findByText('Durata trebuie să fie între 1 și 24 de luni.')).toBeTruthy();
  });

  it('saves the edited offer and shows the success alert', async () => {
    const user = userEvent.setup();
    actions.saveAccessSettings.mockResolvedValue({ ok: true });
    render(<AccessForm initial={INITIAL} />);
    const price = screen.getByLabelText('Preț acces (lei)');
    await user.clear(price);
    await user.type(price, '200,00');
    const bonus = screen.getByLabelText('Credite incluse');
    await user.clear(bonus);
    await user.type(bonus, '50');
    const months = screen.getByLabelText('Durată (luni)');
    await user.clear(months);
    await user.type(months, '6');
    await user.click(screen.getByRole('button', { name: 'Salvează accesul' }));
    await waitFor(() => expect(actions.saveAccessSettings).toHaveBeenCalledTimes(1));
    expect(actions.saveAccessSettings).toHaveBeenCalledWith({ price: '200,00', bonusCredits: 50, durationMonths: 6 });
    expect(await screen.findByText('Oferta de acces a fost salvată.')).toBeTruthy();
  });
});
