import { Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import Reveal from './Reveal';

let mockReducedMotion = false;
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual('react-native-reanimated'),
  useReducedMotion: () => mockReducedMotion,
}));

const { getAnimatedStyle } = Reanimated as unknown as {
  getAnimatedStyle: (node: unknown) => { opacity: number; height: number };
};

beforeEach(() => {
  mockReducedMotion = false;
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

const reveal = (open: boolean) => (
  <Reveal open={open} testID="reveal">
    <Text>Detalii</Text>
  </Reveal>
);
const style = () => getAnimatedStyle(screen.getByTestId('reveal', { includeHiddenElements: true }));
const measure = async (height: number) => {
  await fireEvent(screen.getByTestId('reveal-content', { includeHiddenElements: true }), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 300, height } },
  });
  await act(async () => jest.advanceTimersByTime(20));
};

it('renders nothing while closed', async () => {
  await render(reveal(false));
  expect(screen.queryByText('Detalii', { includeHiddenElements: true })).toBeNull();
});

it('opens by growing to the measured height and fading in', async () => {
  await render(reveal(false));
  await screen.rerender(reveal(true));
  expect(screen.getByText('Detalii')).toBeTruthy();
  await measure(48);
  await act(async () => jest.advanceTimersByTime(600));
  expect(style()).toMatchObject({ height: 48, opacity: 1 });
});

it('waits for the first measure before opening, so the growth runs over the real height', async () => {
  await render(reveal(false));
  await screen.rerender(reveal(true));
  await act(async () => jest.advanceTimersByTime(600));
  expect(style().opacity).toBe(0); // not run yet: nothing measured
  await measure(48);
  expect(style().opacity).toBeLessThan(1); // now animating
  await act(async () => jest.advanceTimersByTime(600));
  expect(style()).toMatchObject({ height: 48, opacity: 1 });
});

it('closing hides the content from screen readers at once and unmounts it after the animation', async () => {
  await render(reveal(true));
  await measure(48);
  await screen.rerender(reveal(false));
  expect(screen.queryByText('Detalii')).toBeNull();
  expect(screen.getByText('Detalii', { includeHiddenElements: true })).toBeTruthy();
  await act(async () => jest.advanceTimersByTime(600));
  expect(screen.queryByText('Detalii', { includeHiddenElements: true })).toBeNull();
});

it('with reduce motion it opens at full size and closes at once', async () => {
  mockReducedMotion = true;
  await render(reveal(false));
  await screen.rerender(reveal(true));
  await measure(48);
  expect(style()).toMatchObject({ height: 48, opacity: 1 });
  await screen.rerender(reveal(false));
  expect(screen.queryByText('Detalii', { includeHiddenElements: true })).toBeNull();
});
