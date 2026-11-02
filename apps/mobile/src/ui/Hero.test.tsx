import { act, render, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import Hero from './Hero';

let mockReducedMotion = false;
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual('react-native-reanimated'),
  useReducedMotion: () => mockReducedMotion,
}));

// Reanimated's jest helpers; the public typings only describe the no-op production stubs.
const { getAnimatedStyle } = Reanimated as unknown as { getAnimatedStyle: (node: unknown) => { transform: Record<string, number>[] } };
const circle = () => Object.assign({}, ...getAnimatedStyle(screen.getByTestId('hero-circle')).transform);

beforeEach(() => {
  mockReducedMotion = false;
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

it('floats the circle', async () => {
  await render(<Hero welcomeMessage="Salut" lessonCount={3} />);
  await act(async () => jest.advanceTimersByTime(3000));
  expect(circle().scale).not.toBe(1);
});

it('keeps the circle static with reduce motion', async () => {
  mockReducedMotion = true;
  await render(<Hero welcomeMessage="Salut" lessonCount={3} />);
  await act(async () => jest.advanceTimersByTime(3000));
  expect(circle()).toMatchObject({ translateY: 0, scale: 1 });
  expect(Math.abs(circle().translateX)).toBe(0);
});
