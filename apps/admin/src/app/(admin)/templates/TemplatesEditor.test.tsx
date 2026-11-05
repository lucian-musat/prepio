// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TemplateWithUsage } from '@/lib/data/templates';

const { saveTemplateAction, deleteTemplateAction } = vi.hoisted(() => ({
  saveTemplateAction: vi.fn(),
  deleteTemplateAction: vi.fn(),
}));
vi.mock('./actions', () => ({ saveTemplateAction, deleteTemplateAction }));

import TemplatesEditor from './TemplatesEditor';

const templates: TemplateWithUsage[] = [
  { id: 't1', title: 'Rezolvare eseu', exerciseType: 'essay', points: '30p', body: 'Corp', usage: 2 },
  { id: 't2', title: 'Model general', exerciseType: null, points: '', body: 'Alt corp', usage: 0 },
];

beforeEach(() => {
  saveTemplateAction.mockReset().mockResolvedValue({ ok: true });
  deleteTemplateAction.mockReset().mockResolvedValue({ ok: true });
});
afterEach(cleanup);

describe('TemplatesEditor', () => {
  it('renders rows with type label and usage counts', () => {
    render(<TemplatesEditor templates={templates} />);
    const rows = screen.getAllByTestId('template-item');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Rezolvare eseu');
    expect(rows[0].textContent).toContain('Folosit în 2 exerciții');
    expect(rows[1].textContent).toContain('Orice tip');
    expect(rows[1].textContent).toContain('Folosit în 0 exerciții');
  });

  it('adds a template with trimmed fields', async () => {
    const user = userEvent.setup();
    render(<TemplatesEditor templates={templates} />);
    await user.click(screen.getByRole('button', { name: 'Adaugă șablon' }));
    await user.type(screen.getByLabelText('Titlu'), '  Nou  ');
    await user.selectOptions(screen.getByLabelText('Tip'), 'essay');
    await user.type(screen.getByLabelText('Punctaj la BAC'), ' 10p ');
    await user.type(screen.getByLabelText('Conținut'), ' Text ');
    await user.click(screen.getByRole('button', { name: 'Salvează' }));
    expect(saveTemplateAction).toHaveBeenCalledWith({ title: 'Nou', exerciseType: 'essay', points: '10p', body: 'Text' });
  });

  it('edits an existing template keeping its id', async () => {
    const user = userEvent.setup();
    render(<TemplatesEditor templates={templates} />);
    await user.click(screen.getAllByRole('button', { name: 'Editează' })[1]);
    await user.click(screen.getByRole('button', { name: 'Salvează' }));
    expect(saveTemplateAction).toHaveBeenCalledWith({ id: 't2', title: 'Model general', exerciseType: null, points: '', body: 'Alt corp' });
  });

  it('shows the error of a failed delete', async () => {
    deleteTemplateAction.mockResolvedValue({ ok: false, error: 'Șablonul este folosit de 2 exerciții.' });
    const user = userEvent.setup();
    render(<TemplatesEditor templates={templates} />);
    await user.click(screen.getAllByRole('button', { name: 'Șterge' })[0]);
    await user.click(screen.getByRole('button', { name: 'Confirmă ștergerea' }));
    expect(await screen.findByText('Șablonul este folosit de 2 exerciții.')).toBeTruthy();
    expect(deleteTemplateAction).toHaveBeenCalledWith('t1');
  });
});
