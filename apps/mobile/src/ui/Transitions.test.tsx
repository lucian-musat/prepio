import { StyleSheet, Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import Enter from './Enter';
import CardTransition from './CardTransition';

let mockReducedMotion = false;
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual('react-native-reanimated'),
  useReducedMotion: () => mockReducedMotion,
}));

// Reanimated's jest helpers; the public typings only describe the no-op production stubs.
const { getAnimatedStyle } = Reanimated as unknown as {
  getAnimatedStyle: (node: unknown) => { opacity: number; transform: Record<string, number | string>[] };
};

beforeEach(() => {
  mockReducedMotion = false;
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

describe('Enter index (stagger)', () => {
  const style = () => getAnimatedStyle(screen.getByTestId('item'));

  it('waits 40 + index * 50 ms, then rises 12 px into place', async () => {
    await render(<Enter index={3} testID="item" />);
    expect(style().opacity).toBe(0);
    expect(style().transform[0].translateY).toBe(12);
    await act(async () => jest.advanceTimersByTime(180));
    expect(style().opacity).toBe(0); // still inside the 190 ms delay
    await act(async () => jest.advanceTimersByTime(700));
    expect(style().opacity).toBe(1);
    expect(style().transform[0].translateY).toBe(0);
  });

  it('index 3 starts moving at 190 ms: hidden at 185 ms, moving by 200 ms', async () => {
    await render(<Enter index={3} testID="item" />);
    await act(async () => jest.advanceTimersByTime(185));
    expect(style().opacity).toBe(0);
    await act(async () => jest.advanceTimersByTime(15));
    expect(style().opacity).toBeGreaterThan(0);
    expect(style().transform[0].translateY).toBeLessThan(12);
  });

  it('index and config are mutually exclusive in the type', () => {
    // Type-level check (tsc): never rendered.
    // @ts-expect-error index and config together
    const misuse = <Enter index={1} config={{ duration: 100 }} />;
    expect(misuse).toBeTruthy();
  });

  it('with reduced motion renders at rest on the first render', async () => {
    mockReducedMotion = true;
    await render(<Enter index={3} testID="item" />);
    expect(style().opacity).toBe(1);
    expect(style().transform[0].translateY).toBe(0);
  });
});

describe('CardTransition', () => {
  const card = (k: string, direction: 'next' | 'prev' = 'next') => (
    <CardTransition contentKey={k} direction={direction}>
      <Text>Cartonaș {k}</Text>
    </CardTransition>
  );
  const incoming = () => getAnimatedStyle(screen.getByTestId('card-in'));

  it('shows the first card at rest', async () => {
    await render(card('1'));
    expect(incoming().opacity).toBe(1);
    expect(screen.queryByTestId('card-out')).toBeNull();
  });

  it('on key change animates the old card out and the new one in', async () => {
    await render(card('1'));
    await screen.rerender(card('2'));
    expect(screen.getByText('Cartonaș 1', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('Cartonaș 2')).toBeTruthy();
    expect(incoming().opacity).toBe(0);
    expect(incoming().transform).toEqual(expect.arrayContaining([{ translateX: 60 }, { rotate: '2deg' }]));
    await act(async () => jest.advanceTimersByTime(600));
    expect(incoming().opacity).toBe(1);
    expect(screen.queryByText('Cartonaș 1', { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByTestId('card-out')).toBeNull();
  });

  it('with exit off (the old card was swiped away) the new card animates in without an outgoing overlay', async () => {
    await render(card('1'));
    await screen.rerender(
      <CardTransition contentKey="2" direction="next" exit={false}>
        <Text>Cartonaș 2</Text>
      </CardTransition>,
    );
    expect(screen.queryByTestId('card-out', { includeHiddenElements: true })).toBeNull();
    expect(incoming().opacity).toBe(0);
  });

  it('with exit off the container height still eases from the old card to the new one', async () => {
    const box = () => getAnimatedStyle(screen.getByTestId('card-box')) as unknown as { minHeight: number };
    const layout = async (height: number) => {
      await fireEvent(screen.getByTestId('card-in'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 360, height } } });
      await act(async () => jest.advanceTimersByTime(20));
    };
    await render(card('1'));
    await layout(300);
    await screen.rerender(
      <CardTransition contentKey="2" direction="next" exit={false}>
        <Text>Cartonaș 2</Text>
      </CardTransition>,
    );
    expect(box().minHeight).toBe(300);
    await layout(200);
    expect(box().minHeight).toBeGreaterThan(200); // easing, not a jump
    await act(async () => jest.advanceTimersByTime(600));
    expect(box().minHeight).toBe(200);
  });

  it('hides the outgoing card from screen readers and touches during the overlap', async () => {
    await render(card('1'));
    await screen.rerender(card('2'));
    // Default queries skip hidden elements: only the incoming card is reachable.
    expect(screen.queryByText('Cartonaș 1')).toBeNull();
    expect(screen.getByText('Cartonaș 2')).toBeTruthy();
    const out = screen.getByTestId('card-out', { includeHiddenElements: true });
    expect(out.props).toMatchObject({
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
      'aria-hidden': true,
    });
    // In style: the prop form is deprecated on react-native-web.
    expect(StyleSheet.flatten(out.props.style).pointerEvents).toBe('none');
  });

  it('container min-height follows the incoming card layout', async () => {
    const box = () => getAnimatedStyle(screen.getByTestId('card-box')) as unknown as { minHeight: number };
    const layout = async (height: number) => {
      await fireEvent(screen.getByTestId('card-in'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 360, height } } });
      await act(async () => jest.advanceTimersByTime(20)); // one frame for the animated style
    };
    await render(card('1'));
    await layout(300);
    expect(box().minHeight).toBe(300);
    await screen.rerender(card('2'));
    expect(box().minHeight).toBe(300); // holds the old card's height
    await layout(200);
    await act(async () => jest.advanceTimersByTime(600));
    expect(box().minHeight).toBe(200); // eased to the new card
  });

  it('going back enters from the left', async () => {
    await render(card('2'));
    await screen.rerender(card('1', 'prev'));
    expect(incoming().transform).toEqual(expect.arrayContaining([{ translateX: -60 }, { rotate: '-2deg' }]));
  });

  it('with reduced motion swaps straight to the final pose', async () => {
    mockReducedMotion = true;
    await render(card('1'));
    await screen.rerender(card('2'));
    expect(incoming().opacity).toBe(1);
    expect(screen.queryByText('Cartonaș 1', { includeHiddenElements: true })).toBeNull();
  });
});
