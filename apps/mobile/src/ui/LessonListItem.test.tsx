import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { StyleSheet } from 'react-native';
import { color, difficultyTone } from '@prepio/shared';
import LessonListItem from './LessonListItem';

// Reanimated's jest helpers; the public typings only describe the no-op production stubs.
const { getAnimatedStyle } = Reanimated as unknown as {
  getAnimatedStyle: (node: unknown) => { transform: Record<string, number>[] };
};

const transform = () => Object.assign({}, ...getAnimatedStyle(screen.getByTestId('lesson-row')).transform);

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('shrinks while pressed and calls onPress', async () => {
  const onPress = jest.fn();
  await render(<LessonListItem index={0} title="Lecția" onPress={onPress} />);
  const row = screen.getByRole('button', { name: 'Lecția' });
  await fireEvent(row, 'pressIn');
  await act(async () => jest.advanceTimersByTime(400));
  expect(transform()).toMatchObject({ scale: 0.98, translateY: 0 });
  await fireEvent(row, 'pressOut');
  await act(async () => jest.advanceTimersByTime(400));
  expect(transform()).toMatchObject({ scale: 1 });
  await fireEvent.press(row);
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('numbers the tile and alternates teal and yellow tiles', async () => {
  await render(
    <>
      <LessonListItem index={0} title="Prima" onPress={() => {}} />
      <LessonListItem index={1} title="A doua" onPress={() => {}} />
    </>,
  );
  const first = screen.getByText('1');
  const second = screen.getByText('2');
  expect(StyleSheet.flatten(first.props.style).color).toBe(color.primary);
  expect(StyleSheet.flatten(second.props.style).color).toBe(difficultyTone.medium.fg);
});

it('lifts, tints the chevron and nudges it on hover (web), and resets on hover out', async () => {
  await render(<LessonListItem index={0} title="Lecția" onPress={() => {}} />);
  const row = screen.getByRole('button', { name: 'Lecția' });
  await fireEvent(row, 'hoverIn');
  await act(async () => jest.advanceTimersByTime(400));
  expect(transform()).toMatchObject({ translateY: -2, scale: 1 });
  await fireEvent(row, 'hoverOut');
  await act(async () => jest.advanceTimersByTime(400));
  expect(transform()).toMatchObject({ translateY: 0 });
});
