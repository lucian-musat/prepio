import { fireEvent, render, screen } from '@testing-library/react-native';
import TextArea from './TextArea';

it('forwards text changes', async () => {
  const onChangeText = jest.fn();
  await render(
    <TextArea value="" onChangeText={onChangeText} accessibilityLabel="Răspunsul tău" placeholder="Scrie răspunsul tău aici…" />,
  );
  await fireEvent.changeText(screen.getByLabelText('Răspunsul tău'), 'Reforma agrară din 1864');
  expect(onChangeText).toHaveBeenCalledWith('Reforma agrară din 1864');
});
