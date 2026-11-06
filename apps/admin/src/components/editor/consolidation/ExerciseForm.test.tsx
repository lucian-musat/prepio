// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONSOLIDATION_TYPE_LABELS, CONSOLIDATION_TYPES, type Source } from '@prepio/shared';
import type { EditorConsolidation } from '@/lib/data/consolidation';
import ConsolidationEditor from './ConsolidationEditor';
import SpanMarker from './SpanMarker';

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

const data = (over: Partial<EditorConsolidation> = {}): EditorConsolidation => ({
  sources: [SOURCE],
  exercises: [],
  templates: [
    { id: 't-other', title: 'Argumentare', exerciseType: 'argument', points: '', body: 'x' },
    { id: 't-short', title: 'Răspuns scurt pas cu pas', exerciseType: 'short_answer', points: '', body: 'x' },
  ],
  ...over,
});

function setup(d = data()) {
  const user = userEvent.setup();
  render(<ConsolidationEditor lessonId="l1" data={d} />);
  return { user };
}

async function openNew(user: ReturnType<typeof userEvent.setup>, label = 'Răspuns scurt') {
  await user.click(screen.getByRole('button', { name: 'Adaugă exercițiu' }));
  await user.click(screen.getByRole('radio', { name: label }));
}

describe('Consolidare: exercises', () => {
  it('the type picker shows all 10 labels', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Adaugă exercițiu' }));
    const picker = screen.getByRole('radiogroup', { name: 'Tipul exercițiului' });
    const names = within(picker).getAllByRole('radio').map((r) => r.closest('label')?.textContent ?? r.getAttribute('aria-label') ?? '');
    expect(CONSOLIDATION_TYPES).toHaveLength(10);
    for (const t of CONSOLIDATION_TYPES) expect(within(picker).getByRole('radio', { name: CONSOLIDATION_TYPE_LABELS[t] })).toBeTruthy();
    expect(names).toHaveLength(10);
  });

  it('saving a short answer sends the variants split by line and trimmed', async () => {
    actions.saveConsolidationExercise.mockResolvedValue({ ok: true, data: { id: 'new' } });
    const { user } = setup();
    await openNew(user);
    await user.type(screen.getByLabelText('Enunț'), 'Numiți domnul Unirii.');
    fireEvent.change(screen.getByLabelText('Variante acceptate (una pe rând)'), { target: { value: ' Cuza \n\n  Al. I. Cuza\n' } });
    await user.click(screen.getByRole('button', { name: 'Salvează' }));
    expect(actions.saveConsolidationExercise).toHaveBeenCalledTimes(1);
    const [lessonId, input] = actions.saveConsolidationExercise.mock.calls[0]!;
    expect(lessonId).toBe('l1');
    expect(input).toMatchObject({ type: 'short_answer', prompt: 'Numiți domnul Unirii.', accepted: ['Cuza', 'Al. I. Cuza'], mistakes: [] });
    // saved: the form closes
    expect(screen.queryByLabelText('Enunț')).toBeNull();
  });

  it('warns when no template is chosen and lists the matching templates first', async () => {
    const { user } = setup();
    await openNew(user);
    expect(screen.getByText('Exercițiul nu are șablon de rezolvare.')).toBeTruthy();
    const select = screen.getByLabelText('Șablon de rezolvare') as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.textContent);
    expect(options.indexOf('Răspuns scurt pas cu pas')).toBeLessThan(options.indexOf('Argumentare'));
    await user.selectOptions(select, 't-short');
    expect(screen.queryByText('Exercițiul nu are șablon de rezolvare.')).toBeNull();
  });

  it('renders the action errors above the save button', async () => {
    actions.saveConsolidationExercise.mockResolvedValue({ ok: false, error: 'Adaugă cel puțin o variantă acceptată.' });
    const { user } = setup();
    await openNew(user);
    await user.click(screen.getByRole('button', { name: 'Salvează' }));
    expect(screen.getByText('Adaugă cel puțin o variantă acceptată.')).toBeTruthy();
    expect(screen.getByLabelText('Enunț')).toBeTruthy();
  });

  it('an exercise with errors shows the Invalid badge and its errors in the list', () => {
    setup(
      data({
        exercises: [
          {
            exercise: {
              id: 'e1', position: 0, prompt: 'Precizați o informație.', templateId: null, sources: [{ sourceId: 's1', label: 'A' }],
              modelAnswer: null, explanation: null, creditCost: 1, type: 'source_info', count: 1, spans: [],
            },
            ai: { main: '', requirements: {} },
            errors: ['Răspunsul marcat „Cuza” nu mai există în sursă.'],
          },
        ],
      }),
    );
    const row = screen.getByTestId('exercise-item');
    expect(within(row).getByText('Invalid')).toBeTruthy();
    expect(within(row).getByText('Răspunsul marcat „Cuza” nu mai există în sursă.')).toBeTruthy();
    expect(within(row).getByText('Informație din sursă')).toBeTruthy();
    expect(screen.getByText('folosită în 1 exercițiu')).toBeTruthy();
  });
});

describe('Consolidare: sources', () => {
  it('asks before saving a source whose new text detaches marked answers', async () => {
    actions.previewSourceImpact.mockResolvedValue({ ok: true, data: [{ exerciseId: 'e1', prompt: 'Precizați o informație.', detached: ['ales domn'] }] });
    actions.saveSource.mockResolvedValue({ ok: true, data: { id: 's1' } });
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Editează' }));
    fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'Cuza a domnit. Unirea a fost recunoscută.' } });
    await user.click(screen.getByRole('button', { name: 'Salvează sursa' }));
    expect(actions.previewSourceImpact).toHaveBeenCalledWith('s1', 'Cuza a domnit. Unirea a fost recunoscută.');
    expect(actions.saveSource).not.toHaveBeenCalled();
    expect(screen.getByText(/Aceste răspunsuri marcate nu se mai găsesc în textul nou/)).toBeTruthy();
    expect(screen.getByText(/„ales domn”/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Salvează oricum' }));
    expect(actions.saveSource).toHaveBeenCalledWith('l1', expect.objectContaining({ id: 's1', body: 'Cuza a domnit. Unirea a fost recunoscută.' }));
  });

  it('saves directly when nothing detaches', async () => {
    actions.previewSourceImpact.mockResolvedValue({ ok: true, data: [] });
    actions.saveSource.mockResolvedValue({ ok: true, data: { id: 's1' } });
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Editează' }));
    await user.click(screen.getByRole('button', { name: 'Salvează sursa' }));
    expect(actions.saveSource).toHaveBeenCalledTimes(1);
  });
});

describe('SpanMarker', () => {
  it('clicking a highlight shows its controls; Șterge and the limit buttons report changes', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const onChange = vi.fn();
    const span = { id: 'a', sourceId: 's1', start: 23, end: 29, text: 'Unirea', limitStart: null, limitEnd: null };
    render(<SpanMarker source={SOURCE} spans={[span]} onChange={onChange} onRemove={onRemove} actions={[{ label: 'Marchează ca răspuns corect', onClick: () => {} }]} />);
    expect((screen.getByRole('button', { name: 'Marchează ca răspuns corect' }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByText('Unirea'));
    await user.click(screen.getByRole('button', { name: 'Extinde limita: propoziția anterioară' }));
    expect(onChange).toHaveBeenCalledWith({ ...span, limitStart: 0, limitEnd: SOURCE.body.length });
    await user.click(screen.getByRole('button', { name: 'Șterge' }));
    expect(onRemove).toHaveBeenCalledWith('a');
  });

  it('lists spans that no longer match the source text', () => {
    const span = { id: 'a', sourceId: 's1', start: 0, end: 4, text: 'Mihai', limitStart: null, limitEnd: null };
    render(<SpanMarker source={SOURCE} spans={[span]} onChange={() => {}} onRemove={() => {}} actions={[]} />);
    expect(screen.getByText(/nu se mai găsește în text/)).toBeTruthy();
  });
});
