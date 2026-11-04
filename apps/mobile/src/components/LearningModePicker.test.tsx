import { fireEvent, render, screen } from '@testing-library/react-native';
import LearningModePicker from './LearningModePicker';
import { MODE_INFO } from '../lib/learningMode';

it('lists both modes with all their points and recommends the guided one', async () => {
  await render(<LearningModePicker value="guided" onChange={jest.fn()} />);
  for (const info of Object.values(MODE_INFO)) {
    expect(screen.getByText(info.name, { exact: false })).toBeTruthy();
    for (const p of info.points) expect(screen.getByText(p)).toBeTruthy();
  }
  expect(screen.getAllByText('Recomandat')).toHaveLength(1);
});

it('reports the pressed mode', async () => {
  const onChange = jest.fn();
  await render(<LearningModePicker value="guided" onChange={onChange} />);
  await fireEvent.press(screen.getByRole('radio', { name: /Explorare liberă/ }));
  expect(onChange).toHaveBeenCalledWith('free');
});

it('marks only the selected card as checked', async () => {
  await render(<LearningModePicker value="free" onChange={jest.fn()} />);
  expect(screen.getByRole('radio', { name: /Explorare liberă/ }).props.accessibilityState).toMatchObject({ checked: true });
  expect(screen.getByRole('radio', { name: /Traseu ghidat/ }).props.accessibilityState).toMatchObject({ checked: false });
});

it('ignores presses while disabled', async () => {
  const onChange = jest.fn();
  await render(<LearningModePicker value="guided" onChange={onChange} disabled />);
  await fireEvent.press(screen.getByRole('radio', { name: /Explorare liberă/ }));
  expect(onChange).not.toHaveBeenCalled();
});
