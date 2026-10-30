// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Question } from '@prepio/shared';
import type { ActionResult } from '@/lib/actionResult';
import type { QuestionInput } from '@/lib/data/lesson';
import QuestionForm from './QuestionForm';

afterEach(cleanup);

const val = (label: string) => (screen.getByLabelText(label) as HTMLInputElement).value;
const has = (label: string) => screen.queryByLabelText(label) !== null;

type Save = (q: QuestionInput) => Promise<ActionResult<unknown>>;

function setup(initial?: Question, onSave = vi.fn<Save>(async () => ({ ok: true }))) {
  const user = userEvent.setup();
  render(<QuestionForm initial={initial} onSave={onSave} onCancel={() => {}} />);
  return { user, onSave };
}

const single = (correct: [boolean, boolean]): Question => ({
  id: 'q1', position: 0, type: 'single_choice', prompt: 'Enunț', difficulty: 'easy', explanation: null,
  options: [
    { id: 'a', text: 'Unu', correct: correct[0] },
    { id: 'b', text: 'Doi', correct: correct[1] },
  ],
});

describe('QuestionForm', () => {
  it('uses radios for single choice and checkboxes for multiple choice', async () => {
    const { user } = setup(single([true, false]));
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    await user.selectOptions(screen.getByLabelText('Tip'), 'multiple_choice');
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    // existing options are kept when switching between the two choice types
    expect(val('Varianta 1')).toBe('Unu');
  });

  it('switching to chronological order resets options to two empty ordered items', async () => {
    const { user } = setup(single([true, false]));
    await user.selectOptions(screen.getByLabelText('Tip'), 'chronological_order');
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(val('Element 1')).toBe('');
    expect(val('Element 2')).toBe('');
    expect(has('An / etichetă 1')).toBe(true);
    // and back: fresh empty choices, nothing marked correct
    await user.selectOptions(screen.getByLabelText('Tip'), 'single_choice');
    expect(val('Varianta 1')).toBe('');
    expect(screen.getAllByRole('radio').every((r) => !(r as HTMLInputElement).checked)).toBe(true);
  });

  it('multiple → single keeps only the first correct option', async () => {
    const { user } = setup({ ...single([true, true]), type: 'multiple_choice' } as Question);
    await user.selectOptions(screen.getByLabelText('Tip'), 'single_choice');
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios.map((r) => r.checked)).toEqual([true, false]);
  });

  it('shows the validation error and does not save a single choice with two correct answers', async () => {
    const { user, onSave } = setup(single([true, true]));
    await user.click(screen.getByRole('button', { name: 'Salvează' }));
    expect(await screen.findByText('Alegerea simplă trebuie să aibă exact un răspuns corect.')).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves a valid question with trimmed fields and no label when empty', async () => {
    const { user, onSave } = setup();
    await user.type(screen.getByLabelText('Enunț'), 'Care a fost prima?');
    await user.type(screen.getByLabelText('Varianta 1'), 'Răspuns');
    await user.type(screen.getByLabelText('Varianta 2'), 'Altul');
    await user.click(screen.getByLabelText('Corectă 2'));
    await user.click(screen.getByRole('button', { name: 'Salvează' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    const q = onSave.mock.calls[0][0];
    expect(q).toMatchObject({ type: 'single_choice', prompt: 'Care a fost prima?', difficulty: 'medium' });
    const options = q.options as Array<{ text: string; correct: boolean }>;
    expect(options.map((o) => [o.text, o.correct])).toEqual([['Răspuns', false], ['Altul', true]]);
  });

  it('reorders chronological items with the up/down buttons', async () => {
    const { user } = setup({
      id: 'q', position: 0, type: 'chronological_order', prompt: 'p', difficulty: 'easy', explanation: null,
      options: [{ id: 'a', text: 'Primul', label: '1859' }, { id: 'b', text: 'Al doilea' }],
    });
    await user.click(screen.getByRole('button', { name: 'Mută jos 1' }));
    expect((screen.getByLabelText('Element 1') as HTMLInputElement).value).toBe('Al doilea');
    expect((screen.getByLabelText('Element 2') as HTMLInputElement).value).toBe('Primul');
    expect((screen.getByLabelText('An / etichetă 2') as HTMLInputElement).value).toBe('1859');
  });

  it('shows the error returned by the save action', async () => {
    const { user } = setup(single([true, false]), vi.fn<Save>(async () => ({ ok: false, error: 'Eroare de test' })));
    await user.click(screen.getByRole('button', { name: 'Salvează' }));
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Eroare de test')).toBeTruthy();
  });
});
