import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadReminderSettings, saveReminderSettings } from './reminderSettings';

beforeEach(() => AsyncStorage.clear());

it('defaults to enabled at 19:00, not asked yet, when nothing is stored', async () => {
  expect(await loadReminderSettings()).toEqual({ enabled: true, time: { hour: 19, minute: 0 }, asked: false });
});

it('round-trips saved settings', async () => {
  const s = { enabled: false, time: { hour: 8, minute: 30 }, asked: true };
  await saveReminderSettings(s);
  expect(await loadReminderSettings()).toEqual(s);
});

it('falls back to defaults on a corrupt value and repairs invalid fields', async () => {
  await AsyncStorage.setItem('prepio.reminder.v1', '{not json');
  expect(await loadReminderSettings()).toEqual({ enabled: true, time: { hour: 19, minute: 0 }, asked: false });
  await AsyncStorage.setItem('prepio.reminder.v1', JSON.stringify({ enabled: false, time: { hour: 99, minute: 0 }, asked: true }));
  expect(await loadReminderSettings()).toEqual({ enabled: false, time: { hour: 19, minute: 0 }, asked: true });
});
