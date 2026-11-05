import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { color, markerPen, type Source } from '@prepio/shared';
import MarkableText from './MarkableText';
import { initialMarker, type MarkerConfig, type MarkerMark, type MarkerState } from './markerReducer';

const source: Source = {
  id: 's1',
  position: 0,
  title: null,
  author: 'Autor',
  work: 'Lucrare',
  body: 'Unu doi trei patru cinci șase șapte\n\nopt [...] nouă.',
};
const WORDS = ['Unu', 'doi', 'trei', 'patru', 'cinci', 'șase', 'șapte', 'opt', '[...]', 'nouă.'];
const cfg: MarkerConfig = { pens: ['info', 'cause'], limits: { info: 1 } };
const state = (patch: Partial<MarkerState> = {}): MarkerState => ({ ...initialMarker(cfg), ...patch });
const mark = (from: number, to: number, pen: MarkerMark['pen'] = 'info'): MarkerMark => ({ sourceId: 's1', from, to, pen });
const bg = (i: number) => StyleSheet.flatten(screen.getByTestId(`word-${i}`).props.style).backgroundColor;

type Point = { x: number; y: number };
type Config = {
  enabled?: boolean;
  onActivate?: (e: Point) => void;
  onUpdate?: (e: Point) => void;
  onDeactivate?: (e: Point & { canceled?: boolean }) => void;
  onBegin?: (e: Point) => void;
  onFinalize?: (e: Point) => void;
};
// Capture the gestures the component registers (the global gesture mock is a no-op).
const rngh = jest.requireMock('react-native-gesture-handler');
const originals = { usePanGesture: rngh.usePanGesture, useTapGesture: rngh.useTapGesture };
let pans: Config[] = [];
let tap: Config = {};
beforeEach(() => {
  pans = [];
  rngh.usePanGesture = (c: Config) => {
    pans.push(c);
    return {};
  };
  rngh.useTapGesture = (c: Config) => {
    tap = c;
    return {};
  };
});
afterEach(() => Object.assign(rngh, originals));

// One line per paragraph is enough: word i sits at x = 50 * i (40 px wide + space) on its paragraph's line.
async function layoutWords() {
  const layout = (id: string, l: { x: number; y: number; width: number; height: number }) =>
    fireEvent(screen.getByTestId(id), 'layout', { nativeEvent: { layout: l } });
  await layout('paragraph-0', { x: 0, y: 0, width: 400, height: 24 });
  await layout('paragraph-1', { x: 0, y: 40, width: 400, height: 24 });
  for (let i = 0; i < WORDS.length; i++) {
    const col = i < 7 ? i : i - 7;
    await layout(`word-box-${i}`, { x: col * 50, y: 0, width: 50, height: 24 });
    await layout(`word-${i}`, { x: 0, y: 0, width: 40, height: 24 });
  }
}
const mainPan = () => pans[0]!;
// Handles are hidden from assistive tech (drag-only; screen readers mark with tap-tap).
const hidden = { includeHiddenElements: true };

it('renders every word', async () => {
  await render(<MarkableText source={source} state={state()} dispatch={jest.fn()} />);
  for (const w of WORDS) expect(screen.getByText(w)).toBeTruthy();
});

it('mutes omission words', async () => {
  await render(<MarkableText source={source} state={state()} dispatch={jest.fn()} />);
  expect(StyleSheet.flatten(screen.getByText('[...]').props.style).color).toBe(color.textMuted);
  expect(StyleSheet.flatten(screen.getByText('opt').props.style).color).toBe(color.text);
});

it('tapping word 2 then word 5 dispatches two taps', async () => {
  const dispatch = jest.fn();
  await render(<MarkableText source={source} state={state()} dispatch={dispatch} />);
  await layoutWords();
  await act(async () => {
    tap.onActivate?.({ x: 2 * 50 + 10, y: 12 });
    tap.onActivate?.({ x: 5 * 50 + 10, y: 12 });
  });
  expect(dispatch.mock.calls).toEqual([[{ type: 'tap', sourceId: 's1', i: 2 }], [{ type: 'tap', sourceId: 's1', i: 5 }]]);
});

it('hit-tests words in later paragraphs with the paragraph offset', async () => {
  const dispatch = jest.fn();
  await render(<MarkableText source={source} state={state()} dispatch={dispatch} />);
  await layoutWords();
  await act(async () => tap.onActivate?.({ x: 60, y: 50 }));
  expect(dispatch).toHaveBeenCalledWith({ type: 'tap', sourceId: 's1', i: 8 });
});

it('a tap outside the text dispatches nothing', async () => {
  const dispatch = jest.fn();
  await render(<MarkableText source={source} state={state()} dispatch={dispatch} />);
  await layoutWords();
  await act(async () => tap.onActivate?.({ x: 10, y: 200 }));
  expect(dispatch).not.toHaveBeenCalled();
});

it('a drag dispatches dragStart, dragMove and dragEnd', async () => {
  const dispatch = jest.fn();
  await render(<MarkableText source={source} state={state()} dispatch={dispatch} />);
  await layoutWords();
  await act(async () => {
    mainPan().onActivate?.({ x: 60, y: 12 });
    mainPan().onUpdate?.({ x: 160, y: 12 });
    mainPan().onUpdate?.({ x: 160, y: 300 }); // off the text: no move
    mainPan().onDeactivate?.({ x: 160, y: 300 });
  });
  expect(dispatch.mock.calls).toEqual([
    [{ type: 'dragStart', sourceId: 's1', i: 1 }],
    [{ type: 'dragMove', i: 3 }],
    [{ type: 'dragEnd' }],
  ]);
});

it('marks get the pen background, and the space joins words of the same mark', async () => {
  await render(<MarkableText source={source} state={state({ marks: [mark(1, 2), mark(4, 4, 'cause')] })} dispatch={jest.fn()} />);
  expect(bg(0)).toBeUndefined();
  expect(bg(1)).toBe(markerPen.info);
  expect(bg(2)).toBe(markerPen.info);
  expect(bg(4)).toBe(markerPen.cause);
  const space = (i: number) => StyleSheet.flatten(screen.getByTestId(`space-${i}`).props.style)?.backgroundColor;
  expect(space(1)).toBe(markerPen.info);
  expect(space(2)).toBeUndefined();
});

it('an ongoing drag paints with its pen', async () => {
  await render(<MarkableText source={source} state={state({ drag: { sourceId: 's1', pen: 'cause', a: 3, b: 1 } })} dispatch={jest.fn()} />);
  expect([bg(0), bg(1), bg(2), bg(3), bg(4)]).toEqual([undefined, markerPen.cause, markerPen.cause, markerPen.cause, undefined]);
});

it('marks and drags of another source are not painted', async () => {
  const other = { sourceId: 'x', from: 0, to: 3, pen: 'info' as const };
  await render(<MarkableText source={source} state={state({ marks: [other], drag: { sourceId: 'x', pen: 'info', a: 5, b: 6 } })} dispatch={jest.fn()} />);
  expect(WORDS.map((_, i) => bg(i)).every((b) => b === undefined)).toBe(true);
});

it('the active mark shows two handles; dragging the end handle lifts it and moves that end', async () => {
  const dispatch = jest.fn();
  const marks = [mark(1, 3)];
  await render(<MarkableText source={source} state={state({ marks })} dispatch={dispatch} />);
  expect(screen.queryByTestId('handle-start', hidden)).toBeNull();
  await layoutWords();
  await screen.rerender(<MarkableText source={source} state={state({ marks, active: 0 })} dispatch={dispatch} />);
  expect(screen.getByTestId('handle-start', hidden)).toBeTruthy();
  expect(screen.getByTestId('handle-end', hidden)).toBeTruthy();
  // The handles register after the text's own pan; the last one is the end handle.
  const end = pans[pans.length - 1]!;
  await act(async () => {
    (end.onBegin as (e: unknown) => void)({ absoluteX: 300, absoluteY: 500 });
    end.onActivate?.({ x: 0, y: 0 });
    // Word 3's centre is x = 175; 100 px to the right is word 5.
    (end.onUpdate as (e: unknown) => void)({ absoluteX: 400, absoluteY: 500 });
    end.onFinalize?.({ x: 0, y: 0 });
  });
  expect(dispatch.mock.calls).toEqual([
    [{ type: 'handleStart', end: 'end' }],
    [{ type: 'dragMove', i: 5 }],
    [{ type: 'dragEnd' }],
  ]);
});

it('a handle being dragged stays mounted at the moving end', async () => {
  await render(<MarkableText source={source} state={state({ marks: [mark(1, 3)] })} dispatch={jest.fn()} />);
  await layoutWords();
  await screen.rerender(<MarkableText source={source} state={state({ marks: [mark(1, 3)], active: 0 })} dispatch={jest.fn()} />);
  await act(async () => pans[pans.length - 1]!.onActivate?.({ x: 0, y: 0 }));
  await screen.rerender(<MarkableText source={source} state={state({ drag: { sourceId: 's1', pen: 'info', a: 1, b: 5 } })} dispatch={jest.fn()} />);
  expect(screen.getByTestId('handle-end', hidden)).toBeTruthy();
  expect(screen.queryByTestId('handle-start', hidden)).toBeNull();
});

it('read-only: gestures disabled, no handles, no anchor', async () => {
  await render(
    <MarkableText source={source} state={state({ marks: [mark(1, 3)], active: 0, anchor: { sourceId: 's1', i: 5 } })} dispatch={jest.fn()} readOnly />,
  );
  await layoutWords();
  await screen.rerender(
    <MarkableText source={source} state={state({ marks: [mark(1, 3)], active: 0, anchor: { sourceId: 's1', i: 5 } })} dispatch={jest.fn()} readOnly />,
  );
  expect(screen.queryByTestId('handle-start', hidden)).toBeNull();
  expect(screen.queryByTestId('anchor-5')).toBeNull();
  expect(mainPan().enabled).toBe(false);
  expect(tap.enabled).toBe(false);
  expect(bg(1)).toBe(markerPen.info);
});

it('the anchor word gets the dashed outline', async () => {
  await render(<MarkableText source={source} state={state({ anchor: { sourceId: 's1', i: 2 } })} dispatch={jest.fn()} />);
  expect(screen.getByTestId('anchor-2')).toBeTruthy();
  expect(screen.queryByTestId('anchor-3')).toBeNull();
});

it('verdict underlines render in the success, accent and danger colours', async () => {
  await render(
    <MarkableText
      source={source}
      state={state({ marks: [mark(0, 1), mark(3, 3), mark(5, 5)] })}
      dispatch={jest.fn()}
      verdicts={[
        { sourceId: 's1', from: 0, to: 1, verdict: 'ok' },
        { sourceId: 's1', from: 3, to: 3, verdict: 'almost' },
        { sourceId: 's1', from: 5, to: 5, verdict: 'no' },
        { sourceId: 'x', from: 7, to: 7, verdict: 'ok' },
      ]}
    />,
  );
  const ul = (i: number) => StyleSheet.flatten(screen.getByTestId(`verdict-${i}`).props.style);
  expect(ul(0).backgroundColor).toBe(color.success);
  expect(ul(0).height).toBe(3);
  expect(ul(1).backgroundColor).toBe(color.success);
  expect(ul(3).backgroundColor).toBe(color.accent);
  expect(ul(5).backgroundColor).toBe(color.danger);
  expect(screen.queryByTestId('verdict-2')).toBeNull();
  expect(screen.queryByTestId('verdict-7')).toBeNull();
});

it('words are reachable by assistive tech and the activate action taps them', async () => {
  const dispatch = jest.fn();
  await render(<MarkableText source={source} state={state()} dispatch={dispatch} />);
  const word = screen.getByTestId('word-box-3');
  expect(word.props.accessibilityLabel).toBe('patru');
  expect(word.props.accessibilityHint).toMatch(/atinge primul și ultimul cuvânt/i);
  await fireEvent(word, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
  expect(dispatch).toHaveBeenCalledWith({ type: 'tap', sourceId: 's1', i: 3 });
});

it('reading mode uses the reading typeface', async () => {
  await render(<MarkableText source={source} state={state()} dispatch={jest.fn()} reading />);
  expect(StyleSheet.flatten(screen.getByText('Unu').props.style).fontFamily).toBe('Literata');
  await render(<MarkableText source={source} state={state()} dispatch={jest.fn()} />);
  expect(StyleSheet.flatten(screen.getByText('Unu').props.style).fontFamily).toBe('NunitoSans');
});
