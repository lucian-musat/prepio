import { act, render, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import Hero from './Hero';
import { applyOverrides, resetTexts } from '../texts/store';

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
afterEach(() => {
  jest.useRealTimers();
  resetTexts();
});

it('floats the circle', async () => {
  await render(<Hero lessonCount={3} />);
  await act(async () => jest.advanceTimersByTime(3000));
  expect(circle().scale).not.toBe(1);
});

it('keeps the circle static with reduce motion', async () => {
  mockReducedMotion = true;
  await render(<Hero lessonCount={3} />);
  await act(async () => jest.advanceTimersByTime(3000));
  expect(circle()).toMatchObject({ translateY: 0, scale: 1 });
  expect(Math.abs(circle().translateX)).toBe(0);
});

it('shows the catalog welcome paragraph by default', async () => {
  await render(<Hero lessonCount={3} />);
  expect(screen.getByTestId('hero-welcome').props.children).toContain('Bine ai venit în Prepio!');
});

it('shows an admin override of the welcome paragraph', async () => {
  applyOverrides({ 'home.hero.welcome': 'Salut, elevule!' });
  await render(<Hero lessonCount={3} />);
  expect(screen.getByText('Salut, elevule!')).toBeTruthy();
});

it('hides the welcome paragraph when the text is emptied', async () => {
  applyOverrides({ 'home.hero.welcome': '' });
  await render(<Hero lessonCount={3} />);
  expect(screen.queryByTestId('hero-welcome')).toBeNull();
});
