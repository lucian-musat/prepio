import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BAC_GRADE_NOTE } from '@prepio/shared';
import TermsScreen from './TermsScreen';
import { CONTACT_EMAIL, OPERATOR_ADDRESS, OPERATOR_CUI, OPERATOR_NAME, TERMS_DATE, TERMS_VERSION } from '../lib/legal';
import { getSupabase } from '../lib/supabase';

jest.mock('../lib/supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true } }));

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const renderScreen = async () =>
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <TermsScreen />
    </SafeAreaProvider>,
  );

const SECTIONS = [
  'Cine suntem',
  'Ce este Prepio',
  'Cine poate folosi aplicația',
  'Contul tău',
  'Credite și acces',
  'Notele și verificările sunt orientative',
  'Folosire corectă',
  'Conținutul',
  'Suspendarea și ștergerea contului',
  'Răspundere',
  'Modificări',
  'Legea aplicabilă',
  'Contact',
];

beforeEach(() => jest.clearAllMocks());

it('uses the terms version the server expects (current_terms_version())', () => {
  expect(TERMS_VERSION).toBe('2026-11-11');
});

it('renders the terms without querying Supabase (public page, no session needed)', async () => {
  await renderScreen();
  expect(screen.getAllByText('Termeni de utilizare').length).toBeGreaterThan(0);
  expect(getSupabase).not.toHaveBeenCalled();
});

it('renders the 13 sections in order', async () => {
  await renderScreen();
  const headers = screen.getAllByRole('header').map((h) => h.props.children);
  const sections = headers.filter((h) => SECTIONS.includes(h));
  expect(sections).toEqual(SECTIONS);
});

it('shows the operator, the contact address and the terms date', async () => {
  await renderScreen();
  for (const value of [OPERATOR_NAME, OPERATOR_CUI, OPERATOR_ADDRESS, CONTACT_EMAIL]) {
    expect(screen.getAllByText(value, { exact: false }).length).toBeGreaterThan(0);
  }
  expect(screen.getByText(`Ultima actualizare: ${TERMS_DATE}.`, { exact: false })).toBeTruthy();
});

it('states the minimum age: 14', async () => {
  await renderScreen();
  expect(screen.queryByText('16 ani', { exact: false })).toBeNull();
  expect(screen.getByText('Prepio este pentru elevii de liceu care au cel puțin 14 ani.')).toBeTruthy();
  expect(screen.getByText(/sub 14 ani.*șters/)).toBeTruthy();
});

it('requires a parent or guardian consent under 18, for using the app and for payments', async () => {
  await renderScreen();
  expect(
    screen.getByText(
      'Dacă ai sub 18 ani, ai nevoie de acordul unui părinte sau al tutorelui ca să folosești Prepio și ca să cumperi credite sau acces complet.',
    ),
  ).toBeTruthy();
  expect(
    screen.getByText(
      'Când îți creezi contul, confirmi că ai cel puțin 14 ani și, dacă ai sub 18 ani, că ai acordul părintelui sau al tutorelui.',
    ),
  ).toBeTruthy();
  expect(screen.getByText('Dacă ai sub 18 ani, cumperi credite sau acces complet doar cu acordul părintelui sau al tutorelui.')).toBeTruthy();
  expect(screen.getByText(/părintele sau tutorele poate cere oricând închiderea contului/i)).toBeTruthy();
  expect(screen.getByText(/fără acordul părintelui.*șters.*rambursăm/)).toBeTruthy();
});

it('does not promise welcome credits', async () => {
  await renderScreen();
  expect(screen.getByText('poți primi credite de bun venit', { exact: false })).toBeTruthy();
  expect(screen.queryByText('primești credite de bun venit', { exact: false })).toBeNull();
});

it('uses the same grade disclaimer as the BAC result', async () => {
  await renderScreen();
  expect(screen.getByText(BAC_GRADE_NOTE, { exact: false })).toBeTruthy();
});

it('says the grade is not official and names the automatic check', async () => {
  await renderScreen();
  expect(screen.getByText(/verificate automat, cu inteligență artificială \(OpenAI\), nu de un profesor/)).toBeTruthy();
  expect(
    screen.getByText('Notele din Prepio nu sunt note oficiale și nu îți influențează rezultatul la examenul de bacalaureat.'),
  ).toBeTruthy();
});

it('explains what happens when a new version is not accepted (sign out, ask for deletion)', async () => {
  await renderScreen();
  expect(
    screen.getByText(
      `Dacă nu o accepți, nu mai poți folosi aplicația. Poți ieși din cont și ne poți cere ștergerea contului la ${CONTACT_EMAIL}.`,
    ),
  ).toBeTruthy();
});

it('links to the privacy policy', async () => {
  await renderScreen();
  fireEvent.press(screen.getByText('Politica de confidențialitate'));
  expect(router.push).toHaveBeenCalledWith('/confidentialitate');
});
