// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CreditSettingsInput } from '@/lib/data/credits';
import CreditsForm from './CreditsForm';

const actions = vi.hoisted(() => ({ saveCreditSettingsAction: vi.fn() }));
vi.mock('./actions', () => actions);

afterEach(() => {
  cleanup();
  actions.saveCreditSettingsAction.mockReset();
});

const INITIAL: CreditSettingsInput = {
  welcomeCredits: 12,
  packages: [
    { id: 'a', credits: 20, priceBani: 999, featured: false, active: true },
    { id: 'b', credits: 50, priceBani: 1999, featured: true, active: true },
  ],
};

describe('CreditsForm', () => {
  it('shows the per-credit price while typing a price', async () => {
    const user = userEvent.setup();
    render(<CreditsForm initial={INITIAL} />);
    const price = screen.getByLabelText('Preț pachet 2 (lei)');
    await user.clear(price);
    await user.type(price, '19,99');
    expect(screen.getByText('0,40 lei / credit')).toBeTruthy();
  });

  it('shows a dash for an invalid price', async () => {
    const user = userEvent.setup();
    render(<CreditsForm initial={INITIAL} />);
    const price = screen.getByLabelText('Preț pachet 2 (lei)');
    await user.clear(price);
    await user.type(price, 'abc');
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('reorders with the arrows and submits parsed bani in the new order', async () => {
    const user = userEvent.setup();
    actions.saveCreditSettingsAction.mockResolvedValue({ ok: true });
    render(<CreditsForm initial={INITIAL} />);
    await user.click(screen.getByRole('button', { name: 'Mută pachetul 2 în sus' }));
    const price = screen.getByLabelText('Preț pachet 2 (lei)'); // now the 20-credit package
    await user.clear(price);
    await user.type(price, '10,5');
    await user.click(screen.getByRole('button', { name: 'Salvează creditele' }));
    await waitFor(() => expect(actions.saveCreditSettingsAction).toHaveBeenCalledTimes(1));
    expect(actions.saveCreditSettingsAction).toHaveBeenCalledWith({
      welcomeCredits: 12,
      packages: [
        { id: 'b', credits: 50, priceBani: 1999, featured: true, active: true },
        { id: 'a', credits: 20, priceBani: 1050, featured: false, active: true },
      ],
    });
    expect(await screen.findByText('Creditele au fost salvate.')).toBeTruthy();
  });

  it('adds a package and blocks an unparsable price', async () => {
    const user = userEvent.setup();
    render(<CreditsForm initial={INITIAL} />);
    await user.click(screen.getByRole('button', { name: 'Adaugă pachet' }));
    expect(screen.getByLabelText('Preț pachet 3 (lei)')).toBeTruthy();
    await user.type(screen.getByLabelText('Credite pachet 3'), '10');
    await user.click(screen.getByRole('button', { name: 'Salvează creditele' }));
    expect(actions.saveCreditSettingsAction).not.toHaveBeenCalled();
    expect(await screen.findByText('Pachetul 3: prețul trebuie să fie mai mare de 0.')).toBeTruthy();
  });
});
