import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { applyOverrides, resetTexts } from '../texts/store';
import * as Reanimated from 'react-native-reanimated';
import Skeleton from './Skeleton';

let mockReducedMotion = false;
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual('react-native-reanimated'),
  useReducedMotion: () => mockReducedMotion,
}));

// Reanimated's jest helpers; the public typings only describe the no-op production stubs.
const { getAnimatedStyle } = Reanimated as unknown as { getAnimatedStyle: (node: unknown) => Record<string, unknown> };

beforeEach(() => {
  mockReducedMotion = false;
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

const snapshot = async () => {
  await fireEvent(screen.getByTestId('skeleton-line-0'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 12 } } });
  const read = () => [
    getAnimatedStyle(screen.getByTestId('skeleton-dot-0')),
    getAnimatedStyle(screen.getByTestId('skeleton-sweep-0')),
  ];
  await act(async () => jest.advanceTimersByTime(20)); // one frame for the animated styles
  const before = JSON.stringify(read());
  await act(async () => jest.advanceTimersByTime(300));
  return [before, JSON.stringify(read())];
};

it('dots blink and bars shimmer', async () => {
  await render(<Skeleton lines={[90]} />);
  const [before, after] = await snapshot();
  expect(after).not.toBe(before);
});

it('is static with reduce motion (dots full, highlight held mid-bar)', async () => {
  mockReducedMotion = true;
  await render(<Skeleton lines={[90]} />);
  const [before, after] = await snapshot();
  expect(after).toBe(before);
  expect(getAnimatedStyle(screen.getByTestId('skeleton-dot-0')).opacity).toBe(1);
  expect(getAnimatedStyle(screen.getByTestId('skeleton-sweep-0')).transform).toEqual([{ translateX: -100 }]);
});

describe('texts', () => {
  afterEach(() => resetTexts());
  it('shows the evaluating line from the texts', async () => {
    applyOverrides({ 'common.skeleton.evaluating': '[override]' });
    await render(<Skeleton lines={[90]} />);
    expect(screen.getByText('[override]')).toBeTruthy();
  });
});
