import { act, render, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import Pop, { POP } from './Pop';

let mockReducedMotion = false;
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual('react-native-reanimated'),
  useReducedMotion: () => mockReducedMotion,
}));

// Reanimated's jest helpers; the public typings only describe the no-op production stubs.
const { getAnimatedStyle } = Reanimated as unknown as { getAnimatedStyle: (node: unknown) => { transform: { scale: number }[] } };
const scale = () => getAnimatedStyle(screen.getByTestId('pop')).transform[0].scale;

beforeEach(() => {
  mockReducedMotion = false;
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

it('pops from .6 over 1 to 1.18 and settles at 1', async () => {
  await render(<Pop duration={600} />);
  expect(scale()).toBe(POP.from);
  await act(async () => jest.advanceTimersByTime(360)); // end of the peak segment (60 %)
  expect(scale()).toBeGreaterThan(1.1);
  await act(async () => jest.advanceTimersByTime(400));
  expect(scale()).toBe(1);
});

it('is static at rest with reduce motion', async () => {
  mockReducedMotion = true;
  await render(<Pop duration={600} />);
  expect(scale()).toBe(1);
  await act(async () => jest.advanceTimersByTime(100));
  expect(scale()).toBe(1);
});

it('passes view props through', async () => {
  await render(<Pop duration={420} testID="cap" accessibilityElementsHidden />);
  expect(screen.getByTestId('cap', { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(true);
});
