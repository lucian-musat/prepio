import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { color } from '@prepio/shared';
import OptionRow from './OptionRow';

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
  const style = StyleSheet.flatten(screen.getByRole('radio', { name: /1859/ }).props.style);
  expect(style.backgroundColor).toBe(color.successSubtle);
  expect(style.borderColor).toBe(color.success);
});
