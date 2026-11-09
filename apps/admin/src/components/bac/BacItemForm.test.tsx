// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ESSAY_STYLE, type ConsolidationType } from '@prepio/shared';
import { draftFor } from '@/components/editor/consolidation/exerciseModel';
import type { BacSource } from '@/lib/data/bac';
import BacItemForm from './BacItemForm';

const actions = vi.hoisted(() => ({ saveBacItem: vi.fn() }));
vi.mock('@/app/(admin)/bac/actions', () => actions);

afterEach(() => {
  cleanup();
  actions.saveBacItem.mockReset();
});

const SOURCES: BacSource[] = [
  { id: 's1', section: 1, position: 0, title: 'Despre Carol', author: 'A', work: 'W', body: 'Carol I a devenit domnitor.' },
];
const TEMPLATES = [{ id: 't1', title: 'Răspuns scurt', exerciseType: 'short_answer' as const, points: '', body: 'x' }];

function renderForm(type: ConsolidationType) {
  let n = 0;
  const onDone = vi.fn();
  render(
    <BacItemForm
      subjectId="sub" section={1} sources={SOURCES} templates={TEMPLATES}
      initial={draftFor(type, () => `id-${n++}`)} initialPoints={null} onDone={onDone} onCancel={() => {}}
    />,
  );
  return { user: userEvent.setup(), onDone };
}

describe('BacItemForm', () => {
  it.each(['facts', 'argument', 'essay'] as const)('%s hides the credit cost and the AI fields', (type) => {
    renderForm(type);
    expect(screen.queryByLabelText(/Cost verificare|Cost pe cerință/)).toBeNull();
    expect(screen.queryByLabelText(/Context pentru AI/)).toBeNull();
    expect(screen.queryByLabelText(/Șablon AI/)).toBeNull();
    expect(screen.getByLabelText('Punctaj')).toBeTruthy();
    expect(screen.getByLabelText('Cum rezolv')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Gestionează șabloanele' }).getAttribute('href')).toBe('/templates');
  });

  it('saves a short answer with its points, template, source and barem', async () => {
    actions.saveBacItem.mockResolvedValue({ ok: true, data: { id: 'i1' } });
    const { user, onDone } = renderForm('short_answer');
    await user.type(screen.getByLabelText('Enunț'), 'Numiți domnitorul.');
    await user.selectOptions(screen.getByLabelText('Sursa A a cerinței'), 's1');
    await user.type(screen.getByLabelText('Variante acceptate (una pe rând)'), 'Carol I');
    await user.type(screen.getByLabelText('Punctaj'), '2');
    await user.selectOptions(screen.getByLabelText('Cum rezolv'), 't1');
    await user.type(screen.getByLabelText('Barem'), 'Carol I');
    await user.type(screen.getByLabelText('Trepte de punctaj'), '0, 2');
    await user.click(screen.getByRole('button', { name: 'Salvează' }));
    const [subjectId, section, item, barem] = actions.saveBacItem.mock.calls[0]!;
    expect([subjectId, section]).toEqual(['sub', 1]);
    expect(item).toMatchObject({ type: 'short_answer', prompt: 'Numiți domnitorul.', points: 2, templateId: 't1', accepted: ['Carol I'], sources: [{ sourceId: 's1', label: 'A' }] });
    expect(item).not.toHaveProperty('ai');
    expect(barem).toEqual({ text: 'Carol I', points: 2, steps: [0, 2], essay: null });
    expect(onDone).toHaveBeenCalled();
  });

  it('bad steps are reported without calling the server', async () => {
    const { user } = renderForm('short_answer');
    await user.type(screen.getByLabelText('Trepte de punctaj'), '0, x');
    await user.click(screen.getByRole('button', { name: 'Salvează' }));
    expect(screen.getByText('Treptele de punctaj trebuie să fie numere întregi, separate prin virgulă.')).toBeTruthy();
    expect(actions.saveBacItem).not.toHaveBeenCalled();
  });

  it('shows server errors, one per line', async () => {
    actions.saveBacItem.mockResolvedValue({ ok: false, error: 'Alege un „Cum rezolv”.\nBaremul este obligatoriu.' });
    const { user } = renderForm('short_answer');
    await user.click(screen.getByRole('button', { name: 'Salvează' }));
    expect(screen.getByText(/Alege un „Cum rezolv”\./).textContent).toContain('Baremul este obligatoriu.');
  });

  it('an essay edits the barem per requirement and the style, with the sum line', async () => {
    actions.saveBacItem.mockResolvedValue({ ok: true, data: { id: 'i1' } });
    const { user } = renderForm('essay');
    expect(screen.queryByLabelText('Trepte de punctaj')).toBeNull();
    for (const label of ['Limbaj istoric', 'Structurare', 'Succesiune', 'Limita de spațiu']) expect(screen.getByLabelText(label)).toBeTruthy();
    await user.type(screen.getByLabelText('Punctaj'), '30');
    fireEvent.change(screen.getByLabelText('Punctaj cerință 1'), { target: { value: '24' } });
    await user.type(screen.getByLabelText('Barem cerință 1'), 'Câte 6 p');
    await user.type(screen.getByLabelText('Trepte cerință 1'), '0, 6, 12, 24');
    await user.type(screen.getByLabelText('Barem general'), 'General');
    expect(screen.getByTestId('essay-sum').textContent).toBe('Cerințe 24 p + ordonare 6 p = 30 p');
    await user.click(screen.getByRole('button', { name: 'Salvează' }));
    const [, , item, barem] = actions.saveBacItem.mock.calls[0]!;
    const reqId = (item as { requirements: { id: string }[] }).requirements[0]!.id;
    expect(barem).toEqual({
      text: 'General', points: 30, steps: null,
      essay: { requirements: { [reqId]: { text: 'Câte 6 p', points: 24, steps: [0, 6, 12, 24] } }, style: DEFAULT_ESSAY_STYLE },
    });
  });
});
