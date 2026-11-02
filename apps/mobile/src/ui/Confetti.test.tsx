import { StyleSheet } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import Confetti from './Confetti';

let mockReducedMotion = false;
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual('react-native-reanimated'),
  useReducedMotion: () => mockReducedMotion,
}));

beforeEach(() => {
  mockReducedMotion = false;
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

it('bursts on a positive trigger without catching touches, then clears', async () => {
  await render(<Confetti trigger={0} />);
  expect(screen.queryByTestId('confetti')).toBeNull();
  await screen.rerender(<Confetti trigger={1} />);
  const box = screen.getByTestId('confetti');
  expect(StyleSheet.flatten(box.props.style).pointerEvents).toBe('none');
  await act(async () => jest.advanceTimersByTime(1300));
  expect(screen.queryByTestId('confetti')).toBeNull();
});

it('renders nothing with reduce motion', async () => {
  mockReducedMotion = true;
  await render(<Confetti trigger={1} />);
  expect(screen.queryByTestId('confetti')).toBeNull();
});
