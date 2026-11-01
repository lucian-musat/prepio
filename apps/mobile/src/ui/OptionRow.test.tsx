import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { color } from '@prepio/shared';
import OptionRow from './OptionRow';
import { mixColors } from './elevation';
import * as Reanimated from 'react-native-reanimated';

const { getAnimatedStyle } = Reanimated as unknown as { getAnimatedStyle: (node: unknown) => { borderColor: string } };

let mockReducedMotion = false;
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual('react-native-reanimated'),
  useReducedMotion: () => mockReducedMotion,
}));

beforeEach(() => {
  mockReducedMotion = false;
});

it('exposes checked state', async () => {
  await render(<OptionRow label="1859" marker="B" state="selected" onPress={() => {}} />);
  expect(screen.getByRole('radio', { name: /1859/ }).props.accessibilityState).toMatchObject({ checked: true });
});

it('is unchecked when idle, and a checkbox for multiple choice', async () => {
  await render(<OptionRow label="1866" marker="checkbox" state="idle" onPress={() => {}} />);
  expect(screen.getByRole('checkbox', { name: /1866/ }).props.accessibilityState).toMatchObject({ checked: false });
});

it('wrong state shows the close icon and correct state the check icon', async () => {
  await render(<OptionRow label="1848" marker="A" state="wrong" />);
  expect(screen.getByTestId('option-icon-close')).toBeTruthy();
  expect(screen.queryByTestId('option-icon-check')).toBeNull();
  expect(screen.queryByText('A')).toBeNull();
  await screen.rerender(<OptionRow label="1848" marker="A" state="correct" />);
  expect(screen.getByTestId('option-icon-check')).toBeTruthy();
  expect(screen.queryByTestId('option-icon-close')).toBeNull();
});

it('correct state renders final colours with reduce motion on', async () => {
  mockReducedMotion = true;
  await render(<OptionRow label="1859" marker="B" state="correct" />);
  const style = StyleSheet.flatten(screen.getByTestId('option-face').props.style);
  expect(style.backgroundColor).toBe(color.successSubtle);
  expect(style.borderColor).toBe(color.success);
});

it('a display-only row (no onPress) is not announced as disabled', async () => {
  await render(<OptionRow label="1859" marker="B" state="correct" checked={false} />);
  expect(screen.getByRole('radio', { name: /1859/ }).props.accessibilityState).toMatchObject({ checked: false, disabled: false });
});

it('an explicitly disabled row is announced as disabled', async () => {
  await render(<OptionRow label="1859" marker="B" state="idle" onPress={() => {}} disabled />);
  expect(screen.getByRole('radio', { name: /1859/ }).props.accessibilityState).toMatchObject({ disabled: true });
});

it('uses the accessibility label override', async () => {
  await render(<OptionRow label="1859" marker="B" state="correct" accessibilityLabel="1859, corect" />);
  expect(screen.getByRole('radio', { name: '1859, corect' })).toBeTruthy();
});

it('an idle row takes the prototype hover border (primary 40 % into border); a selected row keeps its own', async () => {
  mockReducedMotion = true;
  await render(<OptionRow label="1859" marker="B" state="idle" onPress={() => {}} />);
  const face = () => getAnimatedStyle(screen.getByTestId('option-face'));
  await fireEvent(screen.getByRole('radio', { name: /1859/ }), 'hoverIn');
  expect(face().borderColor).toBe(mixColors(color.primary, color.border, 0.4));
  await fireEvent(screen.getByRole('radio', { name: /1859/ }), 'hoverOut');
  expect(face().borderColor).toBe(color.border);
  await screen.rerender(<OptionRow label="1859" marker="B" state="selected" onPress={() => {}} />);
  await fireEvent(screen.getByRole('radio', { name: /1859/ }), 'hoverIn');
  expect(face().borderColor).toBe(color.primary);
});
