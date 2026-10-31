import { fireEvent, render, screen } from '@testing-library/react-native';
import Button from './Button';

it('calls onPress once per press', async () => {
  const onPress = jest.fn();
  await render(<Button label="Verifică" onPress={onPress} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Verifică' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('does not call onPress when disabled', async () => {
  const onPress = jest.fn();
  await render(<Button label="Verifică" onPress={onPress} disabled />);
  const button = screen.getByRole('button', { name: 'Verifică' });
  expect(button.props.accessibilityState).toMatchObject({ disabled: true });
  await fireEvent.press(button);
  expect(onPress).not.toHaveBeenCalled();
});

it('does not call onPress while loading', async () => {
  const onPress = jest.fn();
  await render(<Button label="Se evaluează…" onPress={onPress} loading />);
  const button = screen.getByRole('button', { name: 'Se evaluează…' });
  expect(button.props.accessibilityState).toMatchObject({ busy: true });
  await fireEvent.press(button);
  expect(onPress).not.toHaveBeenCalled();
});
