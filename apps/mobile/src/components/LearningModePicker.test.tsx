import { applyOverrides, resetTexts } from '../texts/store';
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

describe('texts wiring', () => {
  afterEach(resetTexts);
  it('shows admin overrides of the mode name and points', async () => {
    applyOverrides({ 'onboarding.mode.guided.name': '[override]', 'onboarding.mode.free.point1': '[point]' });
    await render(<LearningModePicker value="guided" onChange={jest.fn()} />);
    expect(screen.getByText('[override]', { exact: false })).toBeTruthy();
    expect(screen.getByText('[point]')).toBeTruthy();
  });
});
