// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiTemplateWithUsage } from '@/lib/data/aiTemplates';

const { saveAiTemplateAction, deleteAiTemplateAction } = vi.hoisted(() => ({
  saveAiTemplateAction: vi.fn(),
  deleteAiTemplateAction: vi.fn(),
}));
vi.mock('./actions', () => ({ saveAiTemplateAction, deleteAiTemplateAction }));

import AiTemplatesEditor from './AiTemplatesEditor';

const templates: AiTemplateWithUsage[] = [
  { id: 'a1', title: 'Fapte standard', type: 'facts', criteria: 'Verifică faptele', keywords: 'an, loc', responseFormat: 'Scurt', usage: 2 },
  { id: 'a2', title: 'Argument', type: 'argument', criteria: 'Verifică argumentul', keywords: '', responseFormat: '', usage: 0 },
  { id: 'a3', title: 'Fapte alt', type: 'facts', criteria: 'Alt criteriu', keywords: '', responseFormat: '', usage: 1 },
];

beforeEach(() => {
  saveAiTemplateAction.mockReset().mockResolvedValue({ ok: true });
  deleteAiTemplateAction.mockReset().mockResolvedValue({ ok: true });
});
afterEach(cleanup);

describe('AiTemplatesEditor', () => {
  it('groups by type with the Romanian label as heading and shows usage', () => {
    render(<AiTemplatesEditor templates={templates} />);
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['Prezentare fapte', 'Argumentare']);
    const items = screen.getAllByTestId('ai-template-item');
    expect(items).toHaveLength(3);
    expect(items[0]!.textContent).toContain('Folosit în 2 exerciții');
    expect(items[1]!.textContent).toContain('Folosit în 1 exercițiu');
  });

  it('creates a template with trimmed fields', async () => {
    const user = userEvent.setup();
    render(<AiTemplatesEditor templates={templates} />);
    await user.click(screen.getByRole('button', { name: 'Adaugă șablon AI' }));
    await user.type(screen.getByLabelText('Titlu'), '  Nou  ');
    await user.selectOptions(screen.getByLabelText('Tip'), 'viewpoint');
    await user.type(screen.getByLabelText('Ce urmărește AI-ul în răspuns'), ' Criteriu ');
    await user.type(screen.getByLabelText('Cuvinte cheie'), ' a, b ');
    await user.type(screen.getByLabelText('Cum formulează răspunsul'), ' Prietenos ');
    await user.click(screen.getByRole('button', { name: 'Salvează' }));
    expect(saveAiTemplateAction).toHaveBeenCalledWith({
      title: 'Nou', type: 'viewpoint', criteria: 'Criteriu', keywords: 'a, b', responseFormat: 'Prietenos',
    });
  });

  it('edits keeping the id', async () => {
    const user = userEvent.setup();
    render(<AiTemplatesEditor templates={templates} />);
    // grouped order: facts (a1, a3) then argument (a2)... a2 is the last item
    const items = screen.getAllByTestId('ai-template-item');
    await user.click(within(items[2]!).getByRole('button', { name: 'Editează' }));
    await user.click(screen.getByRole('button', { name: 'Salvează' }));
    expect(saveAiTemplateAction).toHaveBeenCalledWith({
      id: 'a2', title: 'Argument', type: 'argument', criteria: 'Verifică argumentul', keywords: '', responseFormat: '',
    });
  });

  it('disables the type select for a template in use', async () => {
    const user = userEvent.setup();
    render(<AiTemplatesEditor templates={templates} />);
    const items = screen.getAllByTestId('ai-template-item');
    await user.click(within(items[0]!).getByRole('button', { name: 'Editează' }));
    expect((screen.getByLabelText('Tip') as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByText('Tipul nu se poate schimba cât timp șablonul este folosit.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Anulează' }));
    await user.click(within(screen.getAllByTestId('ai-template-item')[2]!).getByRole('button', { name: 'Editează' }));
    expect((screen.getByLabelText('Tip') as HTMLSelectElement).disabled).toBe(false);
  });

  it('shows the server error when deleting a template in use', async () => {
    deleteAiTemplateAction.mockResolvedValue({ ok: false, error: 'Șablonul AI este folosit de un exercițiu.' });
    const user = userEvent.setup();
    render(<AiTemplatesEditor templates={templates} />);
    await user.click(screen.getAllByRole('button', { name: 'Șterge' })[0]!);
    await user.click(screen.getByRole('button', { name: 'Confirmă ștergerea' }));
    expect(await screen.findByText('Șablonul AI este folosit de un exercițiu.')).toBeTruthy();
    expect(deleteAiTemplateAction).toHaveBeenCalledWith('a1');
  });
});
