// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BacDetailsForm from './BacDetailsForm';

const actions = vi.hoisted(() => ({
  createBacSubject: vi.fn(),
  updateBacSubject: vi.fn(),
  setBacPublished: vi.fn(async () => ({ ok: true as const })),
}));
vi.mock('@/app/(admin)/bac/actions', () => actions);
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const subject = (published: boolean) =>
  ({ id: 's1', title: 'Subiect', year: 2024, variant: 'V1', creditCost: 10, published }) as never;

describe('BacDetailsForm publish switch', () => {
  it('asks before turning published off', async () => {
    const user = userEvent.setup();
    render(<BacDetailsForm subject={subject(true)} />);
    await user.click(screen.getByLabelText('Publicat'));
    expect(screen.getByText('Retragi subiectul din publicare?')).toBeTruthy();
    expect(actions.setBacPublished).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Retrage' }));
    expect(actions.setBacPublished).toHaveBeenCalledWith('s1', false);
  });

  it('cancelling keeps it published', async () => {
    const user = userEvent.setup();
    render(<BacDetailsForm subject={subject(true)} />);
    await user.click(screen.getByLabelText('Publicat'));
    await user.click(screen.getByRole('button', { name: 'Anulează' }));
    expect(actions.setBacPublished).not.toHaveBeenCalled();
  });

  it('publishes without asking', async () => {
    const user = userEvent.setup();
    render(<BacDetailsForm subject={subject(false)} />);
    await user.click(screen.getByLabelText('Publicat'));
    expect(actions.setBacPublished).toHaveBeenCalledWith('s1', true);
  });
});
