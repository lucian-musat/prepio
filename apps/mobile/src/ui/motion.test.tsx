import { act, render, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { ReduceMotion } from 'react-native-reanimated';
import {
  cardInConfig, cardOutConfig, feedbackConfig, screenConfig, staggerConfig, timing,
} from './motion';
import Enter from './Enter';

let mockReducedMotion = false;
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual('react-native-reanimated'),
  useReducedMotion: () => mockReducedMotion,
}));

it('motion configs respect reduce motion', () => {
  for (const c of [staggerConfig(0), screenConfig('forward'), screenConfig('back'), cardInConfig('next'), cardInConfig('prev'), cardOutConfig('next'), cardOutConfig('prev'), timing(100)]) {
    expect(c.reduceMotion).toBe(ReduceMotion.System);
  }
});

it('stagger delay grows by 50 ms', () => {
  expect(staggerConfig(0).delay).toBe(40);
  expect(staggerConfig(3).delay).toBe(190);
});

it('configs use the token durations', () => {
  expect(staggerConfig(0).duration).toBe(420);
  expect(screenConfig('back').duration).toBe(420);
  expect(cardInConfig('next').duration).toBe(420);
});

it('feedback slides up 14 px over the slow duration and respects reduce motion', () => {
  expect(feedbackConfig).toEqual({ duration: 420, translateY: 14, reduceMotion: ReduceMotion.System });
});

// Reanimated's jest helpers; the public typings only describe the no-op production stubs.
const { getAnimatedStyle } = Reanimated as unknown as {
  getAnimatedStyle: (node: unknown) => { opacity: number; transform: { translateY: number }[] };
};

function Probe({ k }: { k: string }) {
  return <Enter key={k} testID="probe" config={feedbackConfig} />;
}

describe('Enter / useEnter', () => {
  beforeEach(() => {
    mockReducedMotion = false;
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  const style = () => getAnimatedStyle(screen.getByTestId('probe'));

  it('starts hidden and offset, then settles at rest', async () => {
    await render(<Probe k="a" />);
    expect(style().opacity).toBe(0);
    expect(style().transform[0].translateY).toBe(14);
    await act(async () => jest.advanceTimersByTime(600));
    expect(style().opacity).toBe(1);
    expect(style().transform[0].translateY).toBe(0);
  });

  it('a key change starts the new content hidden on its first render, then replays', async () => {
    await render(<Probe k="a" />);
    await act(async () => jest.advanceTimersByTime(600));
    await screen.rerender(<Probe k="b" />);
    expect(style().opacity).toBe(0);
    expect(style().transform[0].translateY).toBe(14);
    await act(async () => jest.advanceTimersByTime(600));
    expect(style().opacity).toBe(1);
  });

  it('with reduced motion renders at rest immediately', async () => {
    mockReducedMotion = true;
    await render(<Probe k="a" />);
    expect(style().opacity).toBe(1);
    expect(style().transform[0].translateY).toBe(0);
  });
});
