// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateExercise, type ConsolidationExercise, type Source } from '@prepio/shared';
import type { EditorConsolidation, ExerciseInput } from '@/lib/data/consolidation';
import ConsolidationEditor from './ConsolidationEditor';

const actions = vi.hoisted(() => ({
  saveConsolidationExercise: vi.fn(),
  saveSource: vi.fn(),
  previewSourceImpact: vi.fn(),
  deleteSource: vi.fn(),
  deleteItem: vi.fn(),
  moveItem: vi.fn(),
}));
vi.mock('@/app/(admin)/lessons/[id]/actions', () => actions);

afterEach(() => {
  cleanup();
  Object.values(actions).forEach((f) => f.mockReset());
});

const SOURCE: Source = { id: 's1', position: 0, title: null, author: 'D. Berindei', work: 'Istoria românilor', body: 'Cuza a fost ales domn. Unirea a fost recunoscută.' };
const DATA: EditorConsolidation = {
  sources: [SOURCE],
  exercises: [],
  templates: [{ id: 't-arg', title: 'Argumentare', exerciseType: 'argument', points: '', body: 'x' }],
};

async function openNew(label: string) {
  const user = userEvent.setup();
  render(<ConsolidationEditor lessonId="l1" data={DATA} />);
  await user.click(screen.getByRole('button', { name: 'Adaugă exercițiu' }));
  await user.click(screen.getByRole('radio', { name: label }));
  return user;
}

const CONTEXT_HELP = /Ce trebuie să știe AI-ul ca să dea feedback corect/;

describe('AI types: context', () => {
  it.each(['Prezentare fapte', 'Asemănare / deosebire', 'Punct de vedere', 'Argumentare'])('%s shows the required context with its help', async (label) => {
    await openNew(label);
    expect(screen.getByLabelText(/Context pentru AI/)).toBeTruthy();
    expect(screen.getByText(CONTEXT_HELP).textContent).toContain('Elevul nu vede acest text.');
  });

  it('a facts exercise without context fails with the shared validator message; the form shows it', async () => {
    const bare = { id: 'e', position: 0, type: 'facts', count: 2, prompt: 'p', templateId: null, sources: [], modelAnswer: null, explanation: null, creditCost: 1 } satisfies ConsolidationExercise;
    const [message] = validateExercise(bare, [], { main: '', requirements: {} });
    expect(message).toMatch(/Contextul pentru AI/);
    actions.saveConsolidationExercise.mockResolvedValue({ ok: false, error: message });
    const user = await openNew('Prezentare fapte');
    await user.click(screen.getByRole('button', { name: 'Salvează' }));
    expect(screen.getByText(message!)).toBeTruthy();
  });

  it('saving a facts exercise with context sends ai.main and the count', async () => {
    actions.saveConsolidationExercise.mockResolvedValue({ ok: true, data: { id: 'new' } });
    const user = await openNew('Prezentare fapte');
    await user.type(screen.getByLabelText('Enunț'), 'Prezintă 2 fapte.');
    fireEvent.change(screen.getByLabelText('Câte fapte se cer (N)'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText(/Context pentru AI/), { target: { value: 'Perioada 1859-1866.' } });
    await user.click(screen.getByRole('button', { name: 'Salvează' }));
    const [, input] = actions.saveConsolidationExercise.mock.calls[0]!;
    expect(input).toMatchObject({ type: 'facts', count: 3, ai: { main: 'Perioada 1859-1866.' } });
  });

  it('comparison: Asemănare / Deosebire radio', async () => {
    actions.saveConsolidationExercise.mockResolvedValue({ ok: true, data: { id: 'new' } });
    const user = await openNew('Asemănare / deosebire');
    expect((screen.getByRole('radio', { name: 'Asemănare' }) as HTMLInputElement).checked).toBe(true);
    await user.click(screen.getByRole('radio', { name: 'Deosebire' }));
    fireEvent.change(screen.getByLabelText(/Context pentru AI/), { target: { value: 'ctx' } });
    await user.click(screen.getByRole('button', { name: 'Salvează' }));
    expect(actions.saveConsolidationExercise.mock.calls[0]![1]).toMatchObject({ type: 'comparison', variant: 'difference', ai: { main: 'ctx' } });
  });

  it('viewpoint: N, the span marker and the context; argument: context only', async () => {
    await openNew('Punct de vedere');
    expect(screen.getByLabelText('Câte informații se cer (N)')).toBeTruthy();
    expect(screen.getByText(/Informațiile-suport valide/)).toBeTruthy();
    cleanup();
    await openNew('Argumentare');
    expect(screen.queryByLabelText(/Câte/)).toBeNull();
    expect(screen.getByLabelText(/Context pentru AI/)).toBeTruthy();
  });
});

describe('essay requirements', () => {
  const textOf = () => screen.getAllByLabelText(/^Cerința \d+$/).map((e) => (e as HTMLTextAreaElement).value);
  const fill = (i: number, text: string, ctx: string) => {
    fireEvent.change(screen.getByLabelText(`Cerința ${i}`), { target: { value: text } });
    fireEvent.change(screen.getByLabelText(new RegExp(`^Context pentru AI, cerința ${i}`)), { target: { value: ctx } });
  };

  it('add, reorder and remove keep requirements and ai.requirements keys in step', async () => {
    actions.saveConsolidationExercise.mockResolvedValue({ ok: true, data: { id: 'new' } });
    const user = await openNew('Eseu pe cerințe');
    fill(1, 'A', 'ctx A');
    await user.click(screen.getByRole('button', { name: 'Adaugă cerință' }));
    fill(2, 'B', 'ctx B');
    await user.click(screen.getByRole('button', { name: 'Adaugă cerință' }));
    fill(3, 'C', 'ctx C');
    await user.click(screen.getByRole('button', { name: 'Mută sus cerința 3' }));
    expect(textOf()).toEqual(['A', 'C', 'B']);
    await user.click(screen.getByRole('button', { name: 'Șterge cerința 1' }));
    expect(textOf()).toEqual(['C', 'B']);
    await user.type(screen.getByLabelText('Enunț'), 'Eseu');
    await user.click(screen.getAllByRole('checkbox', { name: 'Cerință de argumentare (verifică conectorii)' })[0]!);
    await user.click(screen.getByRole('button', { name: 'Salvează' }));
    const input = actions.saveConsolidationExercise.mock.calls[0]![1] as Extract<ExerciseInput, { type: 'essay' }>;
    expect(input.requirements.map((r) => r.text)).toEqual(['C', 'B']);
    expect(input.requirements[0]!.argument).toBe(true);
    const ids = input.requirements.map((r) => r.id);
    expect(Object.keys(input.ai.requirements).sort()).toEqual([...ids].sort());
    expect(ids.map((id) => input.ai.requirements[id])).toEqual(['ctx C', 'ctx B']);
  });

  it('a 7th requirement can not be added', async () => {
    const user = await openNew('Eseu pe cerințe');
    for (let i = 0; i < 5; i++) await user.click(screen.getByRole('button', { name: 'Adaugă cerință' }));
    expect(screen.getAllByLabelText(/^Cerința \d+$/)).toHaveLength(6);
    expect((screen.getByRole('button', { name: 'Adaugă cerință' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('offers the optional model answer and template per requirement', async () => {
    await openNew('Eseu pe cerințe');
    expect(screen.getByLabelText(/^Răspuns model, cerința 1/)).toBeTruthy();
    expect(screen.getByLabelText(/^Șablon de rezolvare, cerința 1/)).toBeTruthy();
  });
});
