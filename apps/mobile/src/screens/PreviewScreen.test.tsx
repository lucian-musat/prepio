import { act, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import PreviewScreen from './PreviewScreen';
import { getSupabase } from '../lib/supabase';

jest.mock('../lib/supabase', () => ({ getSupabase: jest.fn() }));

const ADMIN = 'http://admin.test';
const card = (title: string) => ({ id: 'c1', position: 0, title, type: 'text', text: 'Un paragraf.' });
const message = (title: string, over: Record<string, unknown> = {}) => ({ source: 'prepio-admin', kind: 'card', card: card(title), index: 1, total: 4, ...over });

// A stand-in for the page's `message` events and the admin window that embeds it.
type Listener = (e: { origin: string; data: unknown }) => void;
const win = (globalThis as unknown as { window: Record<string, unknown> }).window;
const original = { add: win.addEventListener, remove: win.removeEventListener, parent: win.parent, os: Platform.OS, env: process.env.EXPO_PUBLIC_ADMIN_ORIGIN };
const parent = { postMessage: jest.fn() };
let listeners: Set<Listener>;
const emit = async (data: unknown, origin = ADMIN) =>
  act(async () => {
    listeners.forEach((l) => l({ origin, data }));
  });

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const renderScreen = async () =>
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <PreviewScreen />
    </SafeAreaProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  listeners = new Set();
  win.addEventListener = jest.fn((type: string, l: Listener) => type === 'message' && listeners.add(l));
  win.removeEventListener = jest.fn((type: string, l: Listener) => type === 'message' && listeners.delete(l));
  win.parent = parent;
  Platform.OS = 'web';
  process.env.EXPO_PUBLIC_ADMIN_ORIGIN = ADMIN;
});
afterEach(() => {
  win.addEventListener = original.add;
  win.removeEventListener = original.remove;
  win.parent = original.parent;
  Platform.OS = original.os;
  if (original.env === undefined) delete process.env.EXPO_PUBLIC_ADMIN_ORIGIN;
  else process.env.EXPO_PUBLIC_ADMIN_ORIGIN = original.env;
});

it('waits for a card, without querying Supabase', async () => {
  await renderScreen();
  expect(screen.getByText('Se așteaptă cardul…')).toBeTruthy();
  expect(screen.getByText('Previzualizare')).toBeTruthy();
  expect(getSupabase).not.toHaveBeenCalled();
});

it('tells the admin window it is ready, targeting only the admin origin', async () => {
  await renderScreen();
  expect(parent.postMessage).toHaveBeenCalledTimes(1);
  expect(parent.postMessage).toHaveBeenCalledWith({ source: 'prepio-preview', kind: 'ready' }, ADMIN);
});

it('renders the card posted by the admin in the lesson frame', async () => {
  await renderScreen();
  await emit(message('Cauzele'));
  expect(screen.getByText('Cauzele')).toBeTruthy();
  expect(screen.getByText('Card 2 din 4')).toBeTruthy();
  expect(screen.getByText('Un paragraf.')).toBeTruthy();
  expect(screen.queryByText('Se așteaptă cardul…')).toBeNull();
  // Frame of the lesson stepper: progress (index+1)/total and the two action buttons, inert.
  expect(screen.getByRole('progressbar').props.accessibilityValue).toMatchObject({ now: 50 });
  expect(screen.getByRole('button', { name: 'Înapoi la cardul anterior' }).props.accessibilityState).toMatchObject({ disabled: true });
  expect(screen.getByRole('button', { name: 'Continuă' }).props.accessibilityState).toMatchObject({ disabled: true });
});

it('replaces the card with each new admin message', async () => {
  await renderScreen();
  await emit(message('Cauzele'));
  await emit(message('Urmările', { index: 3 }));
  expect(screen.getByText('Urmările')).toBeTruthy();
  expect(screen.getByText('Card 4 din 4')).toBeTruthy();
  expect(screen.queryByText('Cauzele')).toBeNull();
});

it('ignores messages from any other origin', async () => {
  await renderScreen();
  await emit(message('Cauzele'), 'https://evil.example');
  expect(screen.queryByText('Cauzele')).toBeNull();
  expect(screen.getByText('Se așteaptă cardul…')).toBeTruthy();
});

it('ignores malformed payloads and keeps the last good card', async () => {
  await renderScreen();
  await emit(message('Cauzele'));
  await emit({});
  await emit({ source: 'prepio-admin', kind: 'card' });
  await emit(message('Rău', { card: { ...card('Rău'), type: 'nope' } }));
  await emit('not an object');
  expect(screen.getByText('Cauzele')).toBeTruthy();
  expect(screen.queryByText('Rău')).toBeNull();
});

it('without a configured admin origin, listens to nobody and posts nothing', async () => {
  delete process.env.EXPO_PUBLIC_ADMIN_ORIGIN;
  await renderScreen();
  await emit(message('Cauzele'), '');
  await emit(message('Cauzele'), 'undefined');
  expect(screen.getByText('Se așteaptă cardul…')).toBeTruthy();
  expect(parent.postMessage).not.toHaveBeenCalled();
});

it('does not post when it is not embedded in a frame', async () => {
  win.parent = win;
  await renderScreen();
  expect(parent.postMessage).not.toHaveBeenCalled();
});

it('removes its message listener on unmount', async () => {
  await renderScreen();
  expect(listeners.size).toBe(1);
  await screen.unmount();
  expect(listeners.size).toBe(0);
});

it('on native, explains the preview is web-only and does not listen', async () => {
  Platform.OS = 'android';
  await renderScreen();
  expect(screen.getByText('Previzualizarea este disponibilă doar pe web.')).toBeTruthy();
  expect(win.addEventListener).not.toHaveBeenCalled();
  expect(parent.postMessage).not.toHaveBeenCalled();
});
