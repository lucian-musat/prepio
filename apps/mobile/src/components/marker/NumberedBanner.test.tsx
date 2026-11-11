import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import NumberedBanner, { NumberedTrayStep } from './NumberedBanner';
import type { MarkerConfig, MarkerMark, MarkerState } from './markerReducer';

const info = (count: number): MarkerConfig => ({ pens: ['info'], limits: { info: count }, numbered: true });
const support: MarkerConfig = { pens: ['support'], limits: { support: 2 }, numbered: true };
const slotted = (slot: number, pen: MarkerMark['pen'] = 'info'): MarkerMark => ({ sourceId: 's', from: slot * 3, to: slot * 3 + 1, pen, slot });
const state = (marks: MarkerMark[], slot: number | null, pen: MarkerState['pen'] = 'info'): MarkerState => ({
  pen: slot === null ? null : pen,
  marks,
  anchor: null,
  drag: null,
  active: null,
  slot,
});
const segment = (k: number) => screen.getByTestId(`num-progress-${k}`);

describe('NumberedBanner', () => {
  it('slot 1 of 2: what to mark now, in the slot colour', async () => {
    await render(<NumberedBanner cfg={info(2)} state={state([], 0)} />);
    expect(screen.getByText('Informația 1 din 2')).toBeTruthy();
    expect(screen.getByText('Marchezi prima informație')).toBeTruthy();
    expect(screen.getByText('INFO 1')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('num-banner').props.style).borderColor).toBe('#7A5A00');
  });

  it('slot 2 of 3 with slot 1 filled: „a doua”, the first segment in slot 1 ink', async () => {
    await render(<NumberedBanner cfg={info(3)} state={state([slotted(0)], 1)} />);
    expect(screen.getByText('Informația 2 din 3')).toBeTruthy();
    expect(screen.getByText('Marchezi a doua informație')).toBeTruthy();
    expect(StyleSheet.flatten(segment(0).props.style).backgroundColor).toBe('#7A5A00');
    expect(segment(0).props.accessibilityValue).toEqual({ text: 'marcat' });
    expect(segment(1).props.accessibilityValue).toEqual({ text: 'nemarcat' });
    expect(screen.getAllByTestId(/num-progress-/)).toHaveLength(3);
  });

  it('redoing a filled slot says so', async () => {
    await render(<NumberedBanner cfg={info(2)} state={state([slotted(0), slotted(1)], 1)} />);
    expect(screen.getByText('Informația 2 din 2 · o refaci')).toBeTruthy();
  });

  it('every slot filled: the done line', async () => {
    await render(<NumberedBanner cfg={info(2)} state={state([slotted(0), slotted(1)], null)} />);
    expect(screen.getByText('✓ Gata, toate informațiile marcate')).toBeTruthy();
    expect(screen.getByText('Atinge un slot sau un marcaj ca să-l schimbi.')).toBeTruthy();
  });

  it('support: „Informația-suport” and SUPORT pills', async () => {
    await render(<NumberedBanner cfg={support} state={state([], 0, 'support')} />);
    expect(screen.getByText('Informația-suport 1 din 2')).toBeTruthy();
    expect(screen.getByText('SUPORT 1')).toBeTruthy();
  });
});

describe('NumberedTrayStep', () => {
  it('the current step and one mini slot per slot; pressing one makes it current', async () => {
    const dispatch = jest.fn();
    await render(<NumberedTrayStep cfg={info(2)} state={state([slotted(0)], 1)} dispatch={dispatch} />);
    expect(screen.getByText('Marchezi a doua informație')).toBeTruthy();
    expect(screen.getByTestId('num-mini-1').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('num-mini-0').props.accessibilityState).toMatchObject({ selected: false });
    await act(async () => void fireEvent.press(screen.getByTestId('num-mini-0')));
    expect(dispatch).toHaveBeenCalledWith({ type: 'setSlot', slot: 0 });
  });

  it('idle: the done line', async () => {
    await render(<NumberedTrayStep cfg={info(2)} state={state([slotted(0), slotted(1)], null)} dispatch={jest.fn()} />);
    expect(screen.getByText('✓ Gata, toate informațiile marcate')).toBeTruthy();
  });
});
