import { useReducer } from 'react';
import { StyleSheet, Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { consolidationColor, tokenizeSource, type Source, type SourceLabel } from '@prepio/shared';
import { initialMarker, markerReducer, type MarkerAction, type MarkerConfig, type MarkerMark, type MarkerState } from './markerReducer';
import MarkSlots from './MarkSlots';
import SourcePanel from './SourcePanel';

const para = (from: number) => Array.from({ length: 30 }, (_, k) => `cuvânt${from + k}`).join(' ');
const long = (id: string): Source => ({
  id,
  position: 0,
  title: null,
  author: 'F. Constantiniu',
  work: 'O istorie sinceră a poporului român',
  body: `${para(0)}\n\n${para(30)}\n\n${para(60)}`,
});
const short: Source = { id: 'short', position: 0, title: null, author: 'Autor', work: 'Lucrare', body: 'Unirea a fost recunoscută în 1861.' };
const PROMPT = 'Scrieți o relație cauză-efect stabilită între două informații selectate din sursa B.';
const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const ce: MarkerConfig = { pens: ['cause', 'effect'], limits: { cause: 1, effect: 1 }, autoNext: { cause: 'effect' } };
const info: MarkerConfig = { pens: ['info'], limits: { info: 2 } };

function textOf(sources: Source[]) {
  return (m: { sourceId: string; from: number; to: number }) => {
    const s = sources.find((x) => x.id === m.sourceId)!;
    return tokenizeSource(s.body).words.slice(m.from, m.to + 1).map((w) => w.text).join(' ');
  };
}

function Harness({
  sources,
  cfg = ce,
  marks = [],
  spy,
  kind = 'cause_effect',
  noMarker = false,
}: {
  sources: Array<{ source: Source; label: SourceLabel }>;
  cfg?: MarkerConfig;
  marks?: MarkerMark[];
  spy?: (a: MarkerAction) => void;
  kind?: 'info' | 'cause_effect';
  noMarker?: boolean;
}) {
  const [state, rawDispatch] = useReducer(markerReducer(cfg), undefined, () => initialMarker(cfg, marks));
  const dispatch = (a: MarkerAction) => {
    spy?.(a);
    rawDispatch(a);
  };
  return (
    <SafeAreaProvider initialMetrics={metrics}>
    <SourcePanel sources={sources} prompt={PROMPT} marker={noMarker ? undefined : { cfg, state, dispatch }}>
      <MarkSlots
        kind={kind}
        count={kind === 'info' ? 2 : 2}
        state={state}
        textOf={textOf(sources.map((s) => s.source))}
        onOpen={() => {}}
        onRemove={(index) => dispatch({ type: 'remove', index })}
        onSwap={() => dispatch({ type: 'swapRoles' })}
      />
      <Text>answer-area</Text>
    </SourcePanel>
    </SafeAreaProvider>
  );
}

const RN = require('react-native');
let width = 360;
let dims: jest.SpyInstance;
beforeEach(() => {
  width = 360;
  dims = jest.spyOn(RN, 'useWindowDimensions').mockImplementation(() => ({ width, height: 800, scale: 2, fontScale: 1 }));
});
afterEach(() => dims.mockRestore());

const press = async (node: Parameters<typeof fireEvent.press>[0]) => act(async () => void fireEvent.press(node));

it('a short source renders inline, with no card and no reader', async () => {
  await render(<Harness sources={[{ source: short, label: 'A' }]} />);
  expect(screen.getByTestId('source-inline-A')).toBeTruthy();
  expect(screen.getByText('Unirea')).toBeTruthy();
  expect(screen.queryByTestId('source-card-A')).toBeNull();
  expect(screen.getByText('answer-area')).toBeTruthy();
});

it('a long source renders the card; pressing it opens the reader with the requirement line', async () => {
  await render(<Harness sources={[{ source: long('b'), label: 'B' }]} />);
  expect(screen.getByTestId('source-card-B')).toBeTruthy();
  expect(screen.getByText('Sursa B')).toBeTruthy();
  expect(screen.getByText('F. Constantiniu · 3 paragrafe · ~1 min')).toBeTruthy();
  expect(screen.getByText('📖 Citește și marchează')).toBeTruthy();
  expect(screen.queryByTestId('source-reader')).toBeNull();
  await press(screen.getByTestId('source-card-B'));
  expect(screen.getByTestId('source-reader')).toBeTruthy();
  expect(screen.getByTestId('reader-task-text')).toHaveTextContent(`Cerința: ${PROMPT}`);
  expect(screen.getByText('F. Constantiniu, O istorie sinceră a poporului român')).toBeTruthy();
  expect(screen.getByText('Trage peste text (ține apăsat, apoi trage) sau atinge primul și ultimul cuvânt.')).toBeTruthy();
});

it('without a marker the card only invites to read and the reader has no pens', async () => {
  await render(<Harness sources={[{ source: long('b'), label: 'B' }]} noMarker />);
  expect(screen.getByText('📖 Citește sursa')).toBeTruthy();
  await press(screen.getByTestId('source-card-B'));
  expect(screen.queryByTestId('pen-cause')).toBeNull();
  expect(screen.getByText('Gata')).toBeTruthy();
});

it('the requirement line expands on tap', async () => {
  await render(<Harness sources={[{ source: long('b'), label: 'B' }]} />);
  await press(screen.getByTestId('source-card-B'));
  const line = () => screen.getByTestId('reader-task-text');
  expect(line().props.numberOfLines).toBe(1);
  await press(screen.getByTestId('reader-task'));
  expect(line().props.numberOfLines).toBeUndefined();
});

it('„Gata” closes the reader and cancels an unfinished selection', async () => {
  const spy = jest.fn();
  await render(<Harness sources={[{ source: long('b'), label: 'B' }]} spy={spy} />);
  await press(screen.getByTestId('source-card-B'));
  await press(screen.getByText('Gata'));
  expect(screen.queryByTestId('source-reader')).toBeNull();
  expect(spy).toHaveBeenCalledWith({ type: 'cancel' });
});

it('pressing the effect slot opens the reader with the effect pen selected', async () => {
  const spy = jest.fn();
  await render(<Harness sources={[{ source: long('b'), label: 'B' }]} spy={spy} />);
  expect(screen.getByText('Efect: marchează în text')).toBeTruthy();
  await press(screen.getByText('Efect: marchează în text'));
  expect(screen.getByTestId('source-reader')).toBeTruthy();
  expect(spy).toHaveBeenCalledWith({ type: 'setPen', pen: 'effect' });
  expect(screen.getByTestId('pen-effect').props.accessibilityState).toMatchObject({ selected: true });
  expect(screen.getByTestId('pen-cause').props.accessibilityState).toMatchObject({ selected: false });
});

it('the tray shows ✓ on used pens and the next-step hint', async () => {
  const marks: MarkerMark[] = [{ sourceId: 'b', from: 2, to: 4, pen: 'cause' }];
  await render(<Harness sources={[{ source: long('b'), label: 'B' }]} marks={marks} />);
  await press(screen.getByTestId('source-card-B'));
  expect(screen.getByText('Cauza e marcată. Acum marchează efectul.')).toBeTruthy();
  expect(screen.getByTestId('pen-cause')).toHaveTextContent(/✓/);
  expect(screen.getByTestId('pen-effect')).not.toHaveTextContent(/✓/);
  // The minimap bar sits at the mark's word position (word 2 of 90).
  expect(screen.getByTestId('minimap-0', { includeHiddenElements: true }).props.style).toEqual(expect.arrayContaining([expect.objectContaining({ top: `${(2 / 90) * 100}%` })]));
});

it('the both-marked hint', async () => {
  const marks: MarkerMark[] = [
    { sourceId: 'b', from: 2, to: 4, pen: 'cause' },
    { sourceId: 'b', from: 40, to: 44, pen: 'effect' },
  ];
  await render(<Harness sources={[{ source: long('b'), label: 'B' }]} marks={marks} />);
  await press(screen.getByTestId('source-card-B'));
  expect(screen.getByText('Ambele marcate. Apasă „Gata” sau ajustează capetele.')).toBeTruthy();
});

it('two long sources: two cards, and A / B tabs in the reader', async () => {
  await render(
    <Harness
      sources={[
        { source: long('a'), label: 'A' },
        { source: long('b'), label: 'B' },
      ]}
    />,
  );
  expect(screen.getByTestId('source-card-A')).toBeTruthy();
  expect(screen.getByTestId('source-card-B')).toBeTruthy();
  await press(screen.getByTestId('source-card-B'));
  expect(screen.getByTestId('reader-tab-A').props.accessibilityState).toMatchObject({ selected: false });
  expect(screen.getByTestId('reader-tab-B').props.accessibilityState).toMatchObject({ selected: true });
  await press(screen.getByTestId('reader-tab-A'));
  expect(screen.getByTestId('reader-tab-A').props.accessibilityState).toMatchObject({ selected: true });
});

it('at 1000 px wide it renders the split, with no card and no reader', async () => {
  width = 1000;
  await render(<Harness sources={[{ source: long('b'), label: 'B' }]} />);
  expect(screen.getByTestId('source-split')).toBeTruthy();
  expect(screen.queryByTestId('source-card-B')).toBeNull();
  expect(screen.getByText(PROMPT)).toBeTruthy();
  expect(screen.getByTestId('pen-cause')).toBeTruthy();
  expect(screen.getByText('answer-area')).toBeTruthy();
  await press(screen.getByText('Efect: marchează în text'));
  expect(screen.queryByTestId('source-reader')).toBeNull();
  expect(screen.getByTestId('pen-effect').props.accessibilityState).toMatchObject({ selected: true });
});

it('a read-only marker (after checking) keeps the marks but offers no pens and only reading', async () => {
  const state = initialMarker(ce, [{ sourceId: 'b', from: 2, to: 4, pen: 'cause' }]);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <SourcePanel sources={[{ source: long('b'), label: 'B' }]} prompt={PROMPT} marker={{ cfg: ce, state, dispatch: jest.fn(), readOnly: true }}>
        <Text>answer-area</Text>
      </SourcePanel>
    </SafeAreaProvider>,
  );
  expect(screen.getByText('📖 Citește sursa')).toBeTruthy();
  await press(screen.getByTestId('source-card-B'));
  expect(screen.queryByTestId('pen-cause')).toBeNull();
  expect(screen.getByText('Gata')).toBeTruthy();
});

it('the split column is as tall as the screen viewport it sits in; its text sits on paper', async () => {
  width = 1000;
  const { ScreenLayout } = require('../../ui');
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ScreenLayout title="x" actions={<Text>Verifică</Text>}>
        <SourcePanel sources={[{ source: long('b'), label: 'B' }]} prompt={PROMPT}>
          <Text>answer-area</Text>
        </SourcePanel>
      </ScreenLayout>
    </SafeAreaProvider>,
  );
  await act(async () => void fireEvent(screen.getByTestId('screen-scroll'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 1000, height: 700 } } }));
  const left = StyleSheet.flatten(screen.getByTestId('split-left').props.style);
  expect(left.height).toBe(700 - 12 - 40);
  expect(left.backgroundColor).toBe(consolidationColor.paper);
});

describe('MarkSlots', () => {
  const src = long('b');
  const base = (patch: Partial<MarkerState>): MarkerState => ({ ...initialMarker(info), ...patch });

  it('disabled: no ✕ and no swap; a verdict shows on its slot; ✕ reaches 48 px', async () => {
    const both = base({
      marks: [
        { sourceId: 'b', from: 0, to: 1, pen: 'cause' },
        { sourceId: 'b', from: 5, to: 6, pen: 'effect' },
      ],
    });
    const r = await render(
      <MarkSlots kind="cause_effect" count={2} state={both} textOf={textOf([src])} onOpen={jest.fn()} onRemove={jest.fn()} onSwap={jest.fn()} disabled verdictOf={(i) => (i === 0 ? 'ok' : 'no')} />,
    );
    expect(screen.queryByLabelText('Șterge cauza')).toBeNull();
    expect(screen.queryByText('⇅ Inversează rolurile')).toBeNull();
    expect(screen.getByLabelText('Verdict: Corect')).toBeTruthy();
    expect(screen.getByLabelText('Verdict: Mai lucrează')).toBeTruthy();
    await r.rerender(<MarkSlots kind="cause_effect" count={2} state={both} textOf={textOf([src])} onOpen={jest.fn()} onRemove={jest.fn()} />);
    const x = screen.getByLabelText('Șterge cauza');
    expect(28 + x.props.hitSlop.top + x.props.hitSlop.bottom).toBeGreaterThanOrEqual(48);
  });

  it('info: filled slots show the quoted text with ✕, empty ones invite to mark', async () => {
    const onRemove = jest.fn();
    const onOpen = jest.fn();
    const state = base({ marks: [{ sourceId: 'b', from: 0, to: 1, pen: 'info' }] });
    await render(<MarkSlots kind="info" count={2} state={state} textOf={textOf([src])} onOpen={onOpen} onRemove={onRemove} />);
    expect(screen.getByText('„cuvânt0 cuvânt1”')).toBeTruthy();
    expect(screen.getByText('Informație: marchează în text')).toBeTruthy();
    await press(screen.getByLabelText('Șterge informația 1'));
    expect(onRemove).toHaveBeenCalledWith(0);
    await press(screen.getByText('„cuvânt0 cuvânt1”'));
    expect(onOpen).toHaveBeenCalledWith('info', 0);
    await press(screen.getByText('Informație: marchează în text'));
    expect(onOpen).toHaveBeenCalledWith('info', null);
  });

  it('cause-effect: the arrow, and „Inversează rolurile” only when both are set', async () => {
    const onSwap = jest.fn();
    const one = base({ marks: [{ sourceId: 'b', from: 0, to: 1, pen: 'cause' }] });
    await render(<MarkSlots kind="cause_effect" count={2} state={one} textOf={textOf([src])} onOpen={jest.fn()} onRemove={jest.fn()} onSwap={onSwap} />);
    expect(screen.getByText('↓ a dus la')).toBeTruthy();
    expect(screen.queryByText('⇅ Inversează rolurile')).toBeNull();
    const both = base({
      marks: [
        { sourceId: 'b', from: 0, to: 1, pen: 'cause' },
        { sourceId: 'b', from: 5, to: 6, pen: 'effect' },
      ],
    });
    await render(<MarkSlots kind="cause_effect" count={2} state={both} textOf={textOf([src])} onOpen={jest.fn()} onRemove={jest.fn()} onSwap={onSwap} />);
    await press(screen.getByText('⇅ Inversează rolurile'));
    expect(onSwap).toHaveBeenCalled();
  });
});
