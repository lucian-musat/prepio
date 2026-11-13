import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { color, type ConsolidationExercise, type ExerciseFeedback, type FeedbackItem, type Source } from '@prepio/shared';
import { initialMarker, type MarkerConfig, type MarkerMark } from '../marker/markerReducer';
import type { PanelMarker } from '../marker/SourceReader';
import ArgumentInput from './ArgumentInput';
import CauseEffectInput from './CauseEffectInput';
import ComparisonInput from './ComparisonInput';
import ConnectorChips from './ConnectorChips';
import FactsInput from './FactsInput';
import LetterInput from './LetterInput';
import MultiAnswerInput from './MultiAnswerInput';
import ShortAnswerInput from './ShortAnswerInput';
import SourceInfoInput from './SourceInfoInput';
import ViewpointInput from './ViewpointInput';
import ExerciseScreen from '../../screens/consolidation/ExerciseScreen';

jest.mock('../../credits/CreditsProvider', () => ({ useCredits: () => ({ balance: 5, change: null }) }));
jest.mock('../../streak/StreakProvider');
jest.mock('../../access/AccessProvider');
jest.mock('../../lib/api', () => ({ evaluateConsolidation: jest.fn() }));

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const wrap = (ui: React.ReactElement) => render(<SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>);

const base = { id: 'e1', position: 1, prompt: 'P', templateId: null, modelAnswer: null, explanation: null };
const ex = <T extends ConsolidationExercise['type']>(c: { type: T } & Record<string, unknown>) =>
  ({ ...base, sources: [{ sourceId: 's1', label: 'A' }], ...c }) as unknown as Extract<ConsolidationExercise, { type: T }>;
const src: Source = { id: 's1', position: 0, title: null, author: 'D. Berindei', work: 'Istoria românilor', body: 'Domnul urma să fie ales pe viață de către Adunarea electivă.' };
const sources = [src];
const item = (key: string, verdict: FeedbackItem['verdict']): FeedbackItem => ({ key, verdict, title: key, good: [], improve: [], ai: true });
const borderOf = (label: string) => StyleSheet.flatten(screen.getByLabelText(label).props.style).borderColor;

const marker = (cfg: MarkerConfig, marks: MarkerMark[]): PanelMarker & { dispatch: jest.Mock } => ({
  cfg,
  state: initialMarker(cfg, marks),
  dispatch: jest.fn(),
});

describe('ShortAnswerInput', () => {
  const e = ex({ type: 'short_answer', accepted: ['Statutul Dezvoltător'], mistakes: [] });
  it('emits the text and colours the border from the verdict', async () => {
    const onChange = jest.fn();
    const props = { exercise: e, sources, onChange, disabled: false };
    const r = await wrap(<ShortAnswerInput {...props} value={{ type: 'short_answer', text: '' }} feedback={null} />);
    await fireEvent.changeText(screen.getByLabelText('Răspunsul tău'), 'Statutul');
    expect(onChange).toHaveBeenCalledWith({ type: 'short_answer', text: 'Statutul' });
    expect(borderOf('Răspunsul tău')).toBe(color.border);
    const fb: ExerciseFeedback = { verdict: 'ok', items: [item('answer', 'ok')] };
    await r.rerender(
      <SafeAreaProvider initialMetrics={metrics}>
        <ShortAnswerInput {...props} value={{ type: 'short_answer', text: 'Statutul' }} feedback={fb} disabled />
      </SafeAreaProvider>,
    );
    expect(borderOf('Răspunsul tău')).toBe(color.success);
  });
});

describe('MultiAnswerInput', () => {
  const e = ex({ type: 'multi_answer', count: 2, groups: [] });
  it('renders N numbered fields, emits the texts and colours each field', async () => {
    const onChange = jest.fn();
    const fb: ExerciseFeedback = { verdict: 'almost', items: [], fields: ['ok', 'no'] };
    await wrap(<MultiAnswerInput exercise={e} sources={sources} value={{ type: 'multi_answer', texts: ['Moldova', ''] }} onChange={onChange} feedback={null} disabled={false} />);
    await fireEvent.changeText(screen.getByLabelText('Răspunsul 2'), 'Valahia');
    expect(onChange).toHaveBeenCalledWith({ type: 'multi_answer', texts: ['Moldova', 'Valahia'] });
    await screen.rerender(
      <SafeAreaProvider initialMetrics={metrics}>
        <MultiAnswerInput exercise={e} sources={sources} value={{ type: 'multi_answer', texts: ['Moldova', 'X'] }} onChange={onChange} feedback={fb} disabled />
      </SafeAreaProvider>,
    );
    expect(borderOf('Răspunsul 1')).toBe(color.success);
    expect(borderOf('Răspunsul 2')).toBe(color.danger);
  });
});

describe('SourceInfoInput', () => {
  const e = ex({ type: 'source_info', count: 1, spans: [] });
  const cfg: MarkerConfig = { pens: ['info'], limits: { info: 1 } };
  it('turns the marker marks into the answer, shows the quoted text and removes a mark with ✕', async () => {
    const onChange = jest.fn();
    const mk = marker(cfg, [{ sourceId: 's1', from: 0, to: 3, pen: 'info' }]);
    await wrap(<SourceInfoInput exercise={e} sources={sources} value={{ type: 'source_info', marks: [] }} onChange={onChange} feedback={null} disabled={false} marker={mk} />);
    expect(onChange).toHaveBeenCalledWith({ type: 'source_info', marks: [{ sourceId: 's1', from: 0, to: 3 }] });
    expect(screen.getByText('„Domnul urma să fie”')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Șterge informația'));
    expect(mk.dispatch).toHaveBeenCalledWith({ type: 'remove', index: 0 });
  });

  it('after checking, a slot shows its verdict and can no longer be removed', async () => {
    const mk = marker(cfg, [{ sourceId: 's1', from: 0, to: 3, pen: 'info' }]);
    const fb: ExerciseFeedback = { verdict: 'almost', items: [], marks: [{ sourceId: 's1', from: 0, to: 3, verdict: 'almost' }] };
    await wrap(<SourceInfoInput exercise={e} sources={sources} value={{ type: 'source_info', marks: [{ sourceId: 's1', from: 0, to: 3 }] }} onChange={jest.fn()} feedback={fb} disabled marker={mk} />);
    expect(screen.queryByLabelText('Șterge informația')).toBeNull();
    expect(screen.getByLabelText('Verdict: Aproape')).toBeTruthy();
  });

  it('numbered: the answer lists the marks in slot order, not in the order they were made', async () => {
    const two = ex({ type: 'source_info', count: 2, spans: [] });
    const numbered: MarkerConfig = { pens: ['info'], limits: { info: 2 }, numbered: true };
    const onChange = jest.fn();
    // Slot 1 was redone after slot 2, so it comes last in the marker.
    const mk = marker(numbered, [
      { sourceId: 's1', from: 5, to: 7, pen: 'info', slot: 1 },
      { sourceId: 's1', from: 0, to: 3, pen: 'info', slot: 0 },
    ]);
    await wrap(<SourceInfoInput exercise={two} sources={sources} value={{ type: 'source_info', marks: [] }} onChange={onChange} feedback={null} disabled={false} marker={mk} />);
    expect(onChange).toHaveBeenCalledWith({
      type: 'source_info',
      marks: [
        { sourceId: 's1', from: 0, to: 3 },
        { sourceId: 's1', from: 5, to: 7 },
      ],
    });
  });
});

describe('CauseEffectInput', () => {
  const e = ex({ type: 'cause_effect', pairs: [] });
  const cfg: MarkerConfig = { pens: ['cause', 'effect'], limits: { cause: 1, effect: 1 }, autoNext: { cause: 'effect', effect: 'cause' }, idleWhenDone: true };
  it('emits cause and effect and swaps the roles', async () => {
    const onChange = jest.fn();
    const mk = marker(cfg, [
      { sourceId: 's1', from: 0, to: 1, pen: 'cause' },
      { sourceId: 's1', from: 4, to: 6, pen: 'effect' },
    ]);
    await wrap(<CauseEffectInput exercise={e} sources={sources} value={{ type: 'cause_effect', cause: null, effect: null }} onChange={onChange} feedback={null} disabled={false} marker={mk} />);
    expect(onChange).toHaveBeenCalledWith({ type: 'cause_effect', cause: { sourceId: 's1', from: 0, to: 1 }, effect: { sourceId: 's1', from: 4, to: 6 } });
    expect(screen.getByText('↓ a dus la')).toBeTruthy();
    await fireEvent.press(screen.getByText('⇅ Inversează'));
    expect(mk.dispatch).toHaveBeenCalledWith({ type: 'swapRoles' });
  });
});

describe('LetterInput', () => {
  const e = ex({ type: 'source_letter', correct: 'A', evidence: null });
  it('picks a letter; after checking the correct one is green and the wrong pick red', async () => {
    const onChange = jest.fn();
    await wrap(<LetterInput exercise={e} sources={sources} value={{ type: 'source_letter', letter: null }} onChange={onChange} feedback={null} disabled={false} />);
    await fireEvent.press(screen.getByText('Sursa B'));
    expect(onChange).toHaveBeenCalledWith({ type: 'source_letter', letter: 'B' });
    await screen.rerender(
      <SafeAreaProvider initialMetrics={metrics}>
        <LetterInput exercise={e} sources={sources} value={{ type: 'source_letter', letter: 'B' }} onChange={onChange} feedback={{ verdict: 'no', items: [] }} disabled />
      </SafeAreaProvider>,
    );
    expect(screen.getByLabelText('Sursa A, răspunsul corect')).toBeTruthy();
    expect(screen.getByLabelText('Sursa B, alegerea ta, greșită')).toBeTruthy();
    expect(screen.getAllByTestId('option-icon-check')).toHaveLength(1);
    expect(screen.getAllByTestId('option-icon-close')).toHaveLength(1);
  });
});

describe('FactsInput', () => {
  const e = ex({ type: 'facts', count: 2 });
  it('one field per fact, coloured from that fact’s feedback', async () => {
    const onChange = jest.fn();
    const fb: ExerciseFeedback = { verdict: 'almost', items: [item('fact-0', 'almost'), item('fact-1', 'ok')] };
    await wrap(<FactsInput exercise={e} sources={[]} value={{ type: 'facts', texts: ['', ''] }} onChange={onChange} feedback={null} disabled={false} />);
    expect(screen.getByText('Faptul istoric 1')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Faptul istoric 2'), 'În 1877 România își proclamă independența.');
    expect(onChange).toHaveBeenCalledWith({ type: 'facts', texts: ['', 'În 1877 România își proclamă independența.'] });
    await screen.rerender(
      <SafeAreaProvider initialMetrics={metrics}>
        <FactsInput exercise={e} sources={[]} value={{ type: 'facts', texts: ['a', 'b'] }} onChange={onChange} feedback={fb} disabled />
      </SafeAreaProvider>,
    );
    expect(borderOf('Faptul istoric 1')).toBe(color.accent);
    expect(borderOf('Faptul istoric 2')).toBe(color.success);
  });
});

describe('ComparisonInput', () => {
  const e = ex({ type: 'comparison', variant: 'similarity' });
  it('one field with a 600-character counter', async () => {
    const onChange = jest.fn();
    await wrap(<ComparisonInput exercise={e} sources={[]} value={{ type: 'comparison', text: 'Atât' }} onChange={onChange} feedback={null} disabled={false} />);
    expect(screen.getByText('4 / 600')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Răspunsul tău'), 'Atât…');
    expect(onChange).toHaveBeenCalledWith({ type: 'comparison', text: 'Atât…' });
  });
});

describe('ViewpointInput', () => {
  const e = ex({ type: 'viewpoint', count: 2, spans: [] });
  const cfg: MarkerConfig = { pens: ['support'], limits: { support: 2 } };
  it('the point of view and two support slots make one answer', async () => {
    const onChange = jest.fn();
    const mk = marker(cfg, [{ sourceId: 's1', from: 0, to: 1, pen: 'support' }]);
    await wrap(<ViewpointInput exercise={e} sources={sources} value={{ type: 'viewpoint', text: 'Consider', marks: [] }} onChange={onChange} feedback={null} disabled={false} marker={mk} />);
    expect(screen.getByText('1 · Punctul tău de vedere')).toBeTruthy();
    expect(screen.getByText('2 · Marchează în sursă două informații care îl susțin')).toBeTruthy();
    expect(onChange).toHaveBeenLastCalledWith({ type: 'viewpoint', text: 'Consider', marks: [{ sourceId: 's1', from: 0, to: 1 }] });
    await fireEvent.changeText(screen.getByLabelText('Punctul tău de vedere'), 'Consider că');
    expect(onChange).toHaveBeenLastCalledWith({ type: 'viewpoint', text: 'Consider că', marks: [] });
    expect(screen.getByText('Informație-suport: marchează în text')).toBeTruthy();
  });
});

describe('ArgumentInput and ConnectorChips', () => {
  it('the chips light up for a causal and a conclusion connector, live', async () => {
    await wrap(<ConnectorChips text="Românii luptă împotriva otomanilor" />);
    expect(screen.getByText('○ Conector de cauzalitate')).toBeTruthy();
    expect(screen.getByText('○ Conector de concluzie')).toBeTruthy();
    await screen.rerender(
      <SafeAreaProvider initialMetrics={metrics}>
        <ConnectorChips text="Luptă deoarece refuză tributul. Așadar, afirmația e adevărată." />
      </SafeAreaProvider>,
    );
    expect(screen.getByText('✓ Conector de cauzalitate')).toBeTruthy();
    expect(screen.getByText('✓ Conector de concluzie')).toBeTruthy();
  });

  it('ArgumentInput emits the text and shows the chips for it', async () => {
    const onChange = jest.fn();
    const e = ex({ type: 'argument' });
    await wrap(<ArgumentInput exercise={e} sources={[]} value={{ type: 'argument', text: 'deoarece' }} onChange={onChange} feedback={null} disabled={false} />);
    expect(screen.getByText('✓ Conector de cauzalitate')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Argumentul tău'), 'Așadar');
    expect(onChange).toHaveBeenCalledWith({ type: 'argument', text: 'Așadar' });
  });
});

describe('ExerciseScreen restore', () => {
  it('a marking exercise comes back with its marks in the slots, their verdicts and the feedback', async () => {
    const e = ex({ type: 'source_info', count: 1, spans: [] });
    const mark = { sourceId: 's1', from: 0, to: 1 };
    await wrap(
      <ExerciseScreen
        exercise={e}
        sources={new Map([['s1', src]])}
        templates={new Map()}
        index={0}
        total={1}
        onBack={jest.fn()}
        onChecked={jest.fn()}
        onContinue={jest.fn()}
        onRetry={jest.fn()}
        onSkip={jest.fn()}
        initial={{
          answer: { type: 'source_info', marks: [mark] },
          feedback: { verdict: 'ok', items: [{ ...item('info-0', 'ok'), title: 'Informație corectă' }], marks: [{ ...mark, verdict: 'ok' }] },
        }}
      />,
    );
    expect(screen.getByText('„Domnul urma”')).toBeTruthy();
    expect(screen.getByLabelText('Verdict: Corect')).toBeTruthy();
    expect(screen.getByText('Informație corectă')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Încearcă din nou' })).toBeTruthy();
  });
});
