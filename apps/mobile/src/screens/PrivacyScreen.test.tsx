import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import PrivacyScreen from './PrivacyScreen';
import { CONTACT_EMAIL, POLICY_DATE } from '../lib/legal';
import { getSupabase } from '../lib/supabase';

jest.mock('../lib/supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true } }));

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const renderScreen = async () =>
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <PrivacyScreen />
    </SafeAreaProvider>,
  );

beforeEach(() => jest.clearAllMocks());

it('renders the policy without querying Supabase (public page, no session needed)', async () => {
  await renderScreen();
  expect(screen.getAllByText('Politica de confidențialitate').length).toBeGreaterThan(0);
  expect(getSupabase).not.toHaveBeenCalled();
});

it('shows the contact address and the policy date', async () => {
  await renderScreen();
  expect(screen.getAllByText(CONTACT_EMAIL, { exact: false }).length).toBeGreaterThan(0);
  expect(screen.getByText(`Ultima actualizare: ${POLICY_DATE}.`, { exact: false })).toBeTruthy();
});

it('covers the data, purposes, processors, retention and rights', async () => {
  await renderScreen();
  for (const heading of ['Ce date colectăm', 'De ce le folosim', 'Cine prelucrează datele', 'Cât timp păstrăm datele', 'Drepturile tale']) {
    expect(screen.getByText(heading)).toBeTruthy();
  }
  for (const processor of ['Supabase', 'Vercel', 'OpenAI']) {
    expect(screen.getByText(processor, { exact: false })).toBeTruthy();
  }
});

it('links to the account deletion page', async () => {
  await renderScreen();
  fireEvent.press(screen.getByText('Cum îți ștergi contul'));
  expect(router.push).toHaveBeenCalledWith('/sterge-cont');
});

it('never says anything is public', async () => {
  await renderScreen();
  expect(JSON.stringify(screen.toJSON())).not.toMatch(/public/i);
});
