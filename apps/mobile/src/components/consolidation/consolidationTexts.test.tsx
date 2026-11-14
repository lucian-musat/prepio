import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { ConsolidationExercise, ExerciseFeedback, SolutionTemplate, Source } from '@prepio/shared';
import { pointsTail } from '../../lib/sourcesNamed';
import ConsolidationEnd from '../../screens/consolidation/ConsolidationEnd';
import ExerciseScreen from '../../screens/consolidation/ExerciseScreen';
import FeedbackView from '../../screens/consolidation/FeedbackView';
import { exerciseStatus } from '../../screens/consolidation/status';
import TemplateSheet from '../../screens/consolidation/TemplateSheet';
import { applyOverrides, resetTexts } from '../../texts/store';
import CauseEffectBanner from '../marker/CauseEffectBanner';
import CauseEffectRelation from '../marker/CauseEffectRelation';
import MarkableText from '../marker/MarkableText';
import MarkSlots from '../marker/MarkSlots';
import NumberedBanner from '../marker/NumberedBanner';
import SourceCard from '../marker/SourceCard';
import SourcePanel from '../marker/SourcePanel';
import SourceReader from '../marker/SourceReader';
import SourceSplit from '../marker/SourceSplit';
import { initialMarker, type MarkerConfig, type MarkerMark, type MarkerState } from '../marker/markerReducer';
import ArgumentInput from './ArgumentInput';
import ComparisonInput from './ComparisonInput';
import ConnectorChips from './ConnectorChips';
import EssayInput from './EssayInput';
import ExerciseMap from './ExerciseMap';
import FactsInput from './FactsInput';
import LetterInput from './LetterInput';
import MultiAnswerInput from './MultiAnswerInput';
import ShortAnswerInput from './ShortAnswerInput';
import ViewpointInput from './ViewpointInput';

jest.mock('../../credits/CreditsProvider', () => ({ useCredits: () => ({ balance: 5, change: null }) }));
jest.mock('../../streak/StreakProvider');
jest.mock('../../access/AccessProvider');
jest.mock('../../lib/api', () => ({ evaluateConsolidation: jest.fn() }));

// Wiring: each consolidation screen / component reads its copy through `t`, so an admin override shows.
const O = '[override]';
afterEach(() => resetTexts());

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const wrap = (ui: React.ReactElement) => render(<SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>);
const base = { id: 'e1', position: 1, prompt: 'P', templateId: null, modelAnswer: null, explanation: null, creditCost: 1 };
const ex = <T extends ConsolidationExercise['type']>(c: { type: T } & Record<string, unknown>) =>
  ({ ...base, sources: [{ sourceId: 's1', label: 'A' }], ...c }) as unknown as Extract<ConsolidationExercise, { type: T }>;
const src: Source = { id: 's1', position: 0, title: null, author: 'Autor', work: 'Lucrare', body: 'Domnul urma să fie ales pe viață.' };
const longSrc: Source = { ...src, body: Array.from({ length: 3 }, (_, p) => Array.from({ length: 40 }, (_, k) => `w${p}${k}`).join(' ')).join('\n\n') };
const noop = jest.fn();
const inputProps = { sources: [src], onChange: noop, feedback: null, disabled: false };
const state = (pen: MarkerState['pen'], marks: MarkerMark[] = [], slot?: number | null): MarkerState => ({
  pen,
  marks,
  anchor: null,
  drag: null,
  active: null,
  ...(slot === undefined ? {} : { slot }),
});
const supportCfg: MarkerConfig = { pens: ['support'], limits: { support: 1 } };

describe('consolidation inputs', () => {
  it('ShortAnswerInput', async () => {
    applyOverrides({ 'consolidation.input.yourAnswer': O });
    await wrap(<ShortAnswerInput {...inputProps} exercise={ex({ type: 'short_answer', accepted: [], mistakes: [] })} value={{ type: 'short_answer', text: '' }} />);
    expect(screen.getByLabelText(O)).toBeTruthy();
  });

  it('MultiAnswerInput', async () => {
    applyOverrides({ 'consolidation.input.multi.answerLabel': '[override {n}]' });
    await wrap(<MultiAnswerInput {...inputProps} exercise={ex({ type: 'multi_answer', count: 2, groups: [] })} value={{ type: 'multi_answer', texts: ['', ''] }} />);
    expect(screen.getByLabelText('[override 2]')).toBeTruthy();
  });

  it('ComparisonInput', async () => {
    applyOverrides({ 'consolidation.input.comparison.placeholder': O });
    await wrap(<ComparisonInput {...inputProps} exercise={ex({ type: 'comparison', variant: 'similarity' })} value={{ type: 'comparison', text: '' }} />);
    expect(screen.getByPlaceholderText(O)).toBeTruthy();
  });

  it('ArgumentInput and ConnectorChips', async () => {
    applyOverrides({ 'consolidation.input.argument.placeholder': O, 'consolidation.input.connectors.causal': '[causal]' });
    await wrap(<ArgumentInput {...inputProps} exercise={ex({ type: 'argument' })} value={{ type: 'argument', text: '' }} />);
    expect(screen.getByPlaceholderText(O)).toBeTruthy();
    expect(screen.getByText(/\[causal\]/)).toBeTruthy();
  });

  it('ConnectorChips (screen reader state)', async () => {
    applyOverrides({ 'consolidation.input.connectors.missing': '{conector} [missing]' });
    await wrap(<ConnectorChips text="" />);
    expect(screen.getByLabelText('Conector de concluzie [missing]')).toBeTruthy();
  });

  it('FactsInput', async () => {
    applyOverrides({ 'consolidation.input.facts.label': '[fact {n}]' });
    await wrap(<FactsInput {...inputProps} exercise={ex({ type: 'facts', count: 1 })} value={{ type: 'facts', texts: [''] }} />);
    expect(screen.getByLabelText('[fact 1]')).toBeTruthy();
  });

  it('LetterInput', async () => {
    applyOverrides({ 'consolidation.source.title': '[sursa {litera}]' });
    await wrap(<LetterInput {...inputProps} exercise={ex({ type: 'source_letter', correct: 'A', evidence: null })} value={{ type: 'source_letter', letter: null }} />);
    expect(screen.getByText('[sursa B]')).toBeTruthy();
  });

  it('ViewpointInput', async () => {
    applyOverrides({ 'consolidation.input.viewpoint.support.one': O });
    const marker = { cfg: supportCfg, state: initialMarker(supportCfg), dispatch: noop };
    await wrap(<ViewpointInput {...inputProps} exercise={ex({ type: 'viewpoint', count: 1, spans: [] })} value={{ type: 'viewpoint', text: '', marks: [] }} marker={marker} />);
    expect(screen.getByText(`2 · Marchează în sursă ${O}`)).toBeTruthy();
  });

  it('EssayInput', async () => {
    applyOverrides({ 'consolidation.input.essay.introWrite': O });
    const essay = ex({ type: 'essay', requirements: [{ id: 'r1', text: 'Cerința', modelAnswer: null, templateId: null, argument: false }] });
    await wrap(<EssayInput {...inputProps} exercise={essay} value={{ type: 'essay', parts: { r1: '' } }} />);
    expect(screen.getByText(O)).toBeTruthy();
  });
});

describe('consolidation screens', () => {
  it('ExerciseMap', async () => {
    applyOverrides({ 'consolidation.map.legend.unsolved': O });
    await render(<ExerciseMap items={[{ id: 'a', chip: 'Corect', tone: { fg: '#000', bg: '#fff', edge: '#ccc' } }]} current={0} onJump={noop} />);
    expect(screen.getByText(O, { includeHiddenElements: true })).toBeTruthy();
  });

  it('status', () => {
    applyOverrides({ 'consolidation.status.unsolved': O, 'consolidation.verdict.ok': '[ok]' });
    const short = ex({ type: 'short_answer', accepted: [], mistakes: [] });
    expect(exerciseStatus(short, undefined).chip).toBe(O);
    const fb: ExerciseFeedback = { verdict: 'ok', items: [] };
    expect(exerciseStatus(short, { exerciseId: 'e1', answer: { type: 'short_answer', text: 'x' }, verdict: 'ok', feedback: fb }).chip).toBe('[ok]');
  });

  it('ConsolidationEnd', async () => {
    applyOverrides({ 'consolidation.end.title': O, 'consolidation.type.shortAnswer': '[type]' });
    await wrap(
      <ConsolidationEnd
        exercises={[ex({ type: 'short_answer', accepted: [], mistakes: [] })]}
        attempts={new Map()}
        onBack={noop}
        onRestart={noop}
        onOpen={noop}
        next={{ label: 'Next', onPress: noop }}
      />,
    );
    expect(screen.getByText(O)).toBeTruthy();
    expect(screen.getByText('[type]')).toBeTruthy();
  });

  it('ExerciseScreen (and the instant check through `t`)', async () => {
    applyOverrides({ 'consolidation.exercise.check': O, 'consolidation.check.correct': '[correct]' });
    await wrap(
      <ExerciseScreen
        exercise={ex({ type: 'short_answer', accepted: ['Cuza'], mistakes: [], sources: [] })}
        sources={new Map()}
        templates={new Map()}
        onBack={noop}
        onChecked={noop}
        onContinue={noop}
        onRetry={noop}
        onSkip={noop}
      />,
    );
    await act(async () => void fireEvent.changeText(screen.getByLabelText('Răspunsul tău'), 'Cuza'));
    await act(async () => void fireEvent.press(screen.getByRole('button', { name: O })));
    expect(await screen.findByText('[correct]')).toBeTruthy();
  });

  it('FeedbackView', async () => {
    applyOverrides({ 'consolidation.feedback.aiNote': O });
    const fb: ExerciseFeedback = { verdict: 'ok', items: [{ key: 'answer', verdict: 'ok', title: 'T', good: [], improve: [], ai: true }] };
    await render(<FeedbackView exercise={ex({ type: 'comparison', variant: 'similarity' })} feedback={fb} />);
    expect(screen.getByText(O)).toBeTruthy();
  });

  it('TemplateSheet', async () => {
    applyOverrides({ 'consolidation.template.gotIt': O });
    const template: SolutionTemplate = { id: 't', title: 'Titlu', exerciseType: null, points: '', body: 'Corp' };
    await wrap(<TemplateSheet template={template} typeLabel="Tip" onClose={noop} />);
    expect(screen.getByRole('button', { name: O })).toBeTruthy();
  });

  it('pointsTail', () => {
    applyOverrides({ 'consolidation.points.many': '[puncte]' });
    expect(pointsTail(2)).toBe('· 2 [puncte]'); // non-breaking spaces
  });
});

describe('marker', () => {
  it('MarkSlots', async () => {
    applyOverrides({ 'consolidation.marker.slot.emptyPrompt': '[{nume}]', 'consolidation.marker.pen.info': '[pen]' });
    await render(<MarkSlots kind="info" count={1} state={state('info')} textOf={() => ''} onOpen={noop} onRemove={noop} />);
    expect(screen.getByText('[[pen]]')).toBeTruthy();
  });

  it('CauseEffectRelation', async () => {
    applyOverrides({ 'consolidation.causeEffect.tapToMark': O });
    await render(<CauseEffectRelation state={state('cause')} textOf={() => ''} onRemove={noop} onSwap={noop} />);
    expect(screen.getAllByText(O)).toHaveLength(2);
  });

  it('CauseEffectBanner (the ROLE copy)', async () => {
    applyOverrides({ 'consolidation.causeEffect.cause.question': O, 'consolidation.causeEffect.cause.clue1': '[clue]' });
    await render(<CauseEffectBanner state={state('cause')} clues />);
    expect(screen.getByText(O)).toBeTruthy();
    expect(screen.getByText('[clue]')).toBeTruthy();
  });

  it('NumberedBanner (and the numbered slot names)', async () => {
    applyOverrides({ 'consolidation.marker.numbered.ordinal1': '[prima]', 'consolidation.marker.pill.info': '[INFO]' });
    await render(<NumberedBanner cfg={{ pens: ['info'], limits: { info: 2 }, numbered: true }} state={state('info', [], 0)} />);
    expect(screen.getByText('Marchezi [prima] informație')).toBeTruthy();
    expect(screen.getByText('[INFO] 1')).toBeTruthy();
  });

  it('MarkableText', async () => {
    applyOverrides({ 'consolidation.marker.pill.cause': O });
    const cfg: MarkerConfig = { pens: ['cause', 'effect'], limits: { cause: 1, effect: 1 } };
    await render(<MarkableText source={src} state={{ ...initialMarker(cfg), marks: [{ sourceId: 's1', from: 0, to: 1, pen: 'cause' }] }} dispatch={noop} />);
    expect(screen.getByText(O, { includeHiddenElements: true })).toBeTruthy();
  });

  it('SourceCard', async () => {
    applyOverrides({ 'consolidation.source.read': O, 'consolidation.source.paragraph.many': '[par]' });
    await render(<SourceCard source={longSrc} label="A" marking={false} onPress={noop} />);
    expect(screen.getByText(O)).toBeTruthy();
    expect(screen.getByText(/3 \[par\]/)).toBeTruthy();
  });

  it('SourcePanel (short source)', async () => {
    applyOverrides({ 'consolidation.source.title': '[sursa {litera}]' });
    await wrap(
      <SourcePanel sources={[{ source: src, label: 'A' }]} prompt="P">
        {null}
      </SourcePanel>,
    );
    expect(screen.getByText('[sursa A]')).toBeTruthy();
  });

  it('SourceSplit', async () => {
    applyOverrides({ 'consolidation.source.title': '[sursa {litera}]' });
    await wrap(
      <SourceSplit sources={[{ source: longSrc, label: 'B' }]} label="B" onLabel={noop} scrollTo={null}>
        {null}
      </SourceSplit>,
    );
    expect(screen.getByText('[sursa B]')).toBeTruthy();
  });

  it('SourceReader', async () => {
    applyOverrides({ 'consolidation.source.done': O, 'consolidation.marker.hint.start': '[hint]' });
    const cfg: MarkerConfig = { pens: ['info'], limits: { info: 1 } };
    await wrap(
      <SourceReader
        visible
        sources={[{ source: longSrc, label: 'A' }]}
        label="A"
        onLabel={noop}
        prompt="P"
        marker={{ cfg, state: initialMarker(cfg), dispatch: noop }}
        scrollTo={null}
        onClose={noop}
      />,
    );
    expect(screen.getByRole('button', { name: O })).toBeTruthy();
    expect(screen.getByText('[hint]')).toBeTruthy();
  });
});
