import { fireEvent, render, screen } from '@testing-library/react-native';
import TextField from './TextField';

it('forwards text changes and submit', async () => {
  const onChangeText = jest.fn();
  const onSubmit = jest.fn();
  await render(
    <TextField value="" onChangeText={onChangeText} onSubmitEditing={onSubmit} accessibilityLabel="Email" placeholder="nume@exemplu.ro" />,
  );
  await fireEvent.changeText(screen.getByLabelText('Email'), 'ana@example.com');
  expect(onChangeText).toHaveBeenCalledWith('ana@example.com');
  await fireEvent(screen.getByLabelText('Email'), 'submitEditing');
  expect(onSubmit).toHaveBeenCalled();
});

it('is single-line', async () => {
  await render(<TextField value="" onChangeText={() => {}} accessibilityLabel="Email" placeholder="" />);
  expect(screen.getByLabelText('Email').props.multiline).toBeFalsy();
});
