// Manual Jest mock for expo-notifications (mapped in jest.config.js): the native module does not exist under Jest.
// Defaults: permission granted, nothing scheduled; tests override the jest.fn()s per case.
export const AndroidImportance = { DEFAULT: 3 };
export const SchedulableTriggerInputTypes = { DATE: 'date' };

export const setNotificationHandler = jest.fn();
export const getPermissionsAsync = jest.fn(async () => ({ status: 'granted' }));
export const requestPermissionsAsync = jest.fn(async () => ({ status: 'granted' }));
export const setNotificationChannelAsync = jest.fn(async () => null);
export const cancelAllScheduledNotificationsAsync = jest.fn(async () => {});
export const scheduleNotificationAsync = jest.fn(async () => 'id');
export const addNotificationResponseReceivedListener = jest.fn((_cb: (r: unknown) => void) => ({ remove: jest.fn() }));
export const getLastNotificationResponseAsync = jest.fn(async () => null);
export const clearLastNotificationResponseAsync = jest.fn(async () => {});
