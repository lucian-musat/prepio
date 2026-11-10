import { fireEvent, render, screen } from '@testing-library/react-native';
import { VERDICT_LABELS } from '@prepio/shared';
import CauseEffectRelation from './CauseEffectRelation';
import type { MarkerMark, MarkerState } from './markerReducer';

const TEXT: Record<string, string> = { '0': 'domnul era obligat să colaboreze cu două guverne,', '5': 'Începuturile domniei au fost anevoioase' };
const textOf = (m: MarkerMark) => TEXT[String(m.from)] ?? '';
const cause: MarkerMark = { sourceId: 's', from: 0, to: 3, pen: 'cause' };
const effect: MarkerMark = { sourceId: 's', from: 5, to: 8, pen: 'effect' };
const state = (pen: MarkerState['pen'], marks: MarkerMark[]): MarkerState => ({ pen, marks, anchor: null, drag: null, active: null });

it('empty: both gaps invite to mark, the current role is outlined', async () => {
  await render(<CauseEffectRelation state={state('cause', [])} textOf={textOf} onRemove={jest.fn()} onSwap={jest.fn()} />);
  expect(screen.getAllByText('Atinge ca să marchezi')).toHaveLength(2);
  expect(screen.getByText('↓ a dus la')).toBeTruthy();
  expect(screen.getByTestId('ce-gap-cause').props.accessibilityState).toMatchObject({ selected: true });
  expect(screen.getByTestId('ce-gap-effect').props.accessibilityState).toMatchObject({ selected: false });
});

it('both marked: no gap outlined, the read-aloud sentence, and ⇅ Inversează swaps', async () => {
  const onSwap = jest.fn();
  await render(<CauseEffectRelation state={state(null, [cause, effect])} textOf={textOf} onRemove={jest.fn()} onSwap={onSwap} />);
  expect(screen.getByTestId('ce-gap-cause').props.accessibilityState).toMatchObject({ selected: false });
  expect(screen.getByTestId('ce-gap-effect').props.accessibilityState).toMatchObject({ selected: false });
  expect(screen.getByTestId('ce-check')).toHaveTextContent(
    /Pentru că domnul era obligat să colaboreze cu două guverne, Începuturile domniei au fost anevoioase\./,
  );
  expect(screen.getByText('Are sens?')).toBeTruthy();
  fireEvent.press(screen.getByText('⇅ Inversează'));
  expect(onSwap).toHaveBeenCalled();
});

it('✕ on the effect removes the effect mark', async () => {
  const onRemove = jest.fn();
  await render(<CauseEffectRelation state={state(null, [cause, effect])} textOf={textOf} onRemove={onRemove} onSwap={jest.fn()} />);
  fireEvent.press(screen.getByLabelText('Șterge efectul'));
  expect(onRemove).toHaveBeenCalledWith(1);
});

it('after checking: verdict badges, no ✕ and no read-aloud check', async () => {
  await render(
    <CauseEffectRelation
      state={state(null, [cause, effect])}
      textOf={textOf}
      onRemove={jest.fn()}
      onSwap={jest.fn()}
      disabled
      verdictOf={(i) => (i === 0 ? 'ok' : 'no')}
    />,
  );
  expect(screen.queryByTestId('ce-check')).toBeNull();
  expect(screen.queryByLabelText('Șterge cauza')).toBeNull();
  expect(screen.getByText(VERDICT_LABELS.ok)).toBeTruthy();
  expect(screen.getByText(VERDICT_LABELS.no)).toBeTruthy();
});
