import { fireEvent, render as rtlRender, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ReminderTimeSheet from './ReminderTimeSheet';
import { applyOverrides, resetTexts } from '../texts/store';

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const render = (ui: ReactElement) => rtlRender(<SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>);

it('lists 15:00 to 22:30 every half hour, with the current one selected', async () => {
  await render(<ReminderTimeSheet visible current={{ hour: 19, minute: 0 }} onSelect={() => {}} onClose={() => {}} />);
  expect(screen.getByText('Ora mementoului')).toBeTruthy();
  const labels = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel as string).filter((l) => /^\d\d:\d\d$/.test(l));
  expect(labels).toHaveLength(16);
  expect(labels[0]).toBe('15:00');
  expect(labels[1]).toBe('15:30');
  expect(labels[15]).toBe('22:30');
  const selected = screen.getAllByRole('button', { selected: true });
  expect(selected).toHaveLength(1);
  expect(selected[0].props.accessibilityLabel).toBe('19:00');
});

it('choosing a time reports it and closes', async () => {
  const onSelect = jest.fn();
  const onClose = jest.fn();
  await render(<ReminderTimeSheet visible current={{ hour: 19, minute: 0 }} onSelect={onSelect} onClose={onClose} />);
  await fireEvent.press(screen.getByLabelText('20:30'));
  expect(onSelect).toHaveBeenCalledWith({ hour: 20, minute: 30 });
  expect(onClose).toHaveBeenCalled();
});

describe('texts', () => {
  afterEach(() => resetTexts());

  it('reads its title from the texts (overrides apply)', async () => {
    applyOverrides({ 'streak.reminderTime.title': '[override]' });
    await render(<ReminderTimeSheet visible current={{ hour: 19, minute: 0 }} onSelect={() => {}} onClose={() => {}} />);
    expect(screen.getByText('[override]')).toBeTruthy();
  });
});
