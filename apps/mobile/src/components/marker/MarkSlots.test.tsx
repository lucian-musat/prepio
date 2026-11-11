import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import MarkSlots from './MarkSlots';
import type { MarkerMark, MarkerState } from './markerReducer';

const slotted = (from: number, to: number, slot: number): MarkerMark => ({ sourceId: 's1', from, to, pen: 'info', slot });
const state = (marks: MarkerMark[], slot: number | null): MarkerState => ({ pen: slot === null ? null : 'info', marks, anchor: null, drag: null, active: null, slot });
const press = async (node: Parameters<typeof fireEvent.press>[0]) => act(async () => void fireEvent.press(node));
const textOf = (m: MarkerMark) => `text ${m.from}`;

describe('numbered slots', () => {
  it('keeps each mark in its own slot, with its pill and number', async () => {
    await render(<MarkSlots kind="info" count={2} numbered state={state([slotted(4, 5, 1)], 0)} textOf={textOf} onOpen={jest.fn()} onRemove={jest.fn()} />);
    expect(screen.getByText('INFO 1')).toBeTruthy();
    expect(screen.getByText('Informația 1: marchează în text')).toBeTruthy();
    expect(screen.getByText('INFO 2')).toBeTruthy();
    expect(screen.getByText('Informația 2')).toBeTruthy();
    expect(screen.getByText('„text 4”')).toBeTruthy();
  });

  it('pressing an empty slot opens it with its slot number', async () => {
    const onOpen = jest.fn();
    await render(<MarkSlots kind="info" count={2} numbered state={state([slotted(4, 5, 1)], 0)} textOf={textOf} onOpen={onOpen} onRemove={jest.fn()} />);
    await press(screen.getByText('Informația 1: marchează în text'));
    expect(onOpen).toHaveBeenCalledWith('info', null, 0);
    await press(screen.getByText('„text 4”'));
    expect(onOpen).toHaveBeenLastCalledWith('info', 0, 1);
  });

  it('the current slot has a border in its ink', async () => {
    await render(<MarkSlots kind="info" count={2} numbered state={state([slotted(0, 1, 0)], 1)} textOf={textOf} onOpen={jest.fn()} onRemove={jest.fn()} />);
    expect(StyleSheet.flatten(screen.getByTestId('slot-1').props.style).borderColor).toBe('#2F4BA8');
    expect(StyleSheet.flatten(screen.getByTestId('slot-0').props.style).borderColor).not.toBe('#7A5A00');
  });

  it('the verdict lands on the slot of its mark', async () => {
    await render(
      <MarkSlots
        kind="info"
        count={2}
        numbered
        disabled
        state={state([slotted(4, 5, 1), slotted(0, 1, 0)], null)}
        textOf={textOf}
        onOpen={jest.fn()}
        onRemove={jest.fn()}
        verdictOf={(i) => (i === 0 ? 'no' : 'ok')}
      />,
    );
    const slot2 = screen.getByTestId('slot-1');
    expect(slot2).toHaveTextContent(/text 4/);
    expect(slot2).toHaveTextContent(/Mai lucrează/);
    expect(screen.getByTestId('slot-0')).toHaveTextContent(/Corect/);
  });

  it('a single-mark requirement has no pill', async () => {
    await render(<MarkSlots kind="info" count={1} state={state([], 0)} textOf={textOf} onOpen={jest.fn()} onRemove={jest.fn()} />);
    expect(screen.queryByText('INFO 1')).toBeNull();
  });
});
