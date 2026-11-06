import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { color } from '@prepio/shared';
import TextArea from './TextArea';

it('forwards text changes', async () => {
  const onChangeText = jest.fn();
  await render(
    <TextArea value="" onChangeText={onChangeText} accessibilityLabel="Răspunsul tău" placeholder="Scrie răspunsul tău aici…" />,
  );
  await fireEvent.changeText(screen.getByLabelText('Răspunsul tău'), 'Reforma agrară din 1864');
  expect(onChangeText).toHaveBeenCalledWith('Reforma agrară din 1864');
});

it('a verdict status colours the border; editable and maxLength reach the input', async () => {
  await render(
    <TextArea value="x" onChangeText={jest.fn()} accessibilityLabel="Fapt" placeholder="…" status="almost" editable={false} maxLength={600} />,
  );
  const input = screen.getByLabelText('Fapt');
  expect(StyleSheet.flatten(input.props.style).borderColor).toBe(color.accent);
  expect(input.props.editable).toBe(false);
  expect(input.props.maxLength).toBe(600);
});
