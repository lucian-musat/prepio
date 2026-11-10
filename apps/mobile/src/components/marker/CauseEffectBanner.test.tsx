import { fireEvent, render, screen } from '@testing-library/react-native';
import { tokenizeSource, type Source } from '@prepio/shared';
import CauseEffectBanner, { CauseEffectTrayStep } from './CauseEffectBanner';
import type { MarkerMark, MarkerState } from './markerReducer';

const body = Array.from({ length: 80 }, (_, i) => `cuvânt${i}`).join(' ');
const source: Source = { id: 's', position: 0, title: null, author: 'Autor', work: 'Lucrare', body };
const words = tokenizeSource(body).words;
const state = (pen: MarkerState['pen'], marks: MarkerMark[] = []): MarkerState => ({ pen, marks, anchor: null, drag: null, active: null });
const cause: MarkerMark = { sourceId: 's', from: 0, to: 1, pen: 'cause' };
const longEffect: MarkerMark = { sourceId: 's', from: 10, to: 69, pen: 'effect' };

describe('CauseEffectBanner', () => {
  it('step 1 asks for the cause, without signal words in BAC', async () => {
    await render(<CauseEffectBanner state={state('cause')} clues={false} />);
    expect(screen.getByText('Pasul 1 din 2 · marchezi cauza')).toBeTruthy();
    expect(screen.getByText('De ce s-a întâmplat ceva?')).toBeTruthy();
    expect(screen.queryByText('fiindcă')).toBeNull();
  });

  it('with clues (consolidation) it lists the signal words', async () => {
    await render(<CauseEffectBanner state={state('cause')} clues />);
    expect(screen.getByText('Caută motivul. Stă de obicei după:')).toBeTruthy();
    expect(screen.getByText('fiindcă')).toBeTruthy();
    expect(screen.getByText('cu scopul de a')).toBeTruthy();
  });

  it('step 2 asks for the effect once the cause is marked; the cause segment is filled', async () => {
    await render(<CauseEffectBanner state={state('effect', [cause])} clues={false} />);
    expect(screen.getByText('Pasul 2 din 2 · marchezi efectul')).toBeTruthy();
    expect(screen.getByText('Ce s-a întâmplat din cauza asta?')).toBeTruthy();
    expect(screen.getByTestId('ce-progress-cause').props.accessibilityValue).toEqual({ text: 'marcat' });
    expect(screen.getByTestId('ce-progress-effect').props.accessibilityValue).toEqual({ text: 'nemarcat' });
  });

  it('both marked: the done line', async () => {
    await render(<CauseEffectBanner state={state(null, [cause, longEffect])} clues />);
    expect(screen.getByText('✓ Gata, ambele roluri marcate')).toBeTruthy();
    expect(screen.queryByText('fiindcă')).toBeNull();
  });
});

describe('CauseEffectTrayStep', () => {
  it('two mini gaps: the marked text on one line, „nemarcat”, the current role selected', async () => {
    await render(<CauseEffectTrayStep state={state('cause', [longEffect])} sources={[source]} dispatch={jest.fn()} />);
    const effectText = screen.getByTestId('ce-mini-effect-text');
    expect(effectText).toHaveTextContent(`„${words.slice(10, 70).map((w) => w.text).join(' ')}”`);
    expect(effectText.props.numberOfLines).toBe(1);
    expect(screen.getByTestId('ce-mini-cause')).toHaveTextContent(/nemarcat/);
    expect(screen.getByTestId('ce-mini-cause').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('ce-mini-effect').props.accessibilityState).toMatchObject({ selected: false });
    expect(screen.getByText('De ce s-a întâmplat ceva?')).toBeTruthy();
  });

  it('pressing a mini gap makes that role current', async () => {
    const dispatch = jest.fn();
    await render(<CauseEffectTrayStep state={state(null, [cause, longEffect])} sources={[source]} dispatch={dispatch} />);
    fireEvent.press(screen.getByTestId('ce-mini-effect'));
    expect(dispatch).toHaveBeenCalledWith({ type: 'setPen', pen: 'effect' });
    expect(screen.getByText('✓ Gata, ambele roluri marcate')).toBeTruthy();
  });

  it('never shows signal words', async () => {
    await render(<CauseEffectTrayStep state={state('effect', [cause])} sources={[source]} dispatch={jest.fn()} />);
    expect(screen.queryByText('ca urmare')).toBeNull();
  });
});
