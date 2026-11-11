import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import PrivacyScreen from './PrivacyScreen';
import { CONTACT_EMAIL, OPERATOR_NAME, POLICY_DATE } from '../lib/legal';
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

it('states where data is stored and processed: Supabase in London (UK adequacy), OpenAI possibly in the USA', async () => {
  await renderScreen();
  expect(screen.getByText(/Supabase.*Londra.*Regatul Unit/)).toBeTruthy();
  expect(screen.getByText(/Comisia Europeană recunoaște un nivel adecvat de protecție a datelor pentru Regatul Unit/)).toBeTruthy();
  expect(screen.queryByText(/Uniunea Europeană/)).toBeNull();
  expect(screen.getByText(/OpenAI.*în afara UE \(în SUA\)/)).toBeTruthy();
});

it('states the minimum age: 14, a parent consent under 18, and accounts of younger users are deleted', async () => {
  await renderScreen();
  expect(screen.getByText('Vârsta minimă')).toBeTruthy();
  expect(screen.queryByText('16 ani', { exact: false })).toBeNull();
  expect(screen.getByText('Prepio este pentru elevii de liceu care au cel puțin 14 ani.')).toBeTruthy();
  expect(screen.getByText('Dacă ai sub 18 ani, folosești Prepio cu acordul părintelui sau al tutorelui.')).toBeTruthy();
  expect(screen.getByText(/părintele sau tutorele poate cere.*ștergerea contului/i)).toBeTruthy();
  expect(screen.getByText(/sub 14 ani sau unui minor care folosește Prepio fără acordul\s+părintelui, contul este șters/)).toBeTruthy();
});

it('gives the legal basis: contract and legitimate interest', async () => {
  await renderScreen();
  expect(screen.getByText(/art\. 6 alin\. \(1\) lit\. b/)).toBeTruthy();
  expect(screen.getByText(/art\. 6 alin\. \(1\) lit\. f/)).toBeTruthy();
});

it('lists Sentry as a processor that receives no names, emails or answers', async () => {
  await renderScreen();
  expect(
    screen.getByText(
      'Sentry ne ajută să aflăm de erorile din aplicație. Datele sunt stocate în UE. Sentry primește detaliile erorii, date despre dispozitiv sau browser și un identificator tehnic al contului, dar nu numele, adresa de email sau răspunsurile tale.',
    ),
  ).toBeTruthy();
});

it('says OpenAI checks consolidation answers and BAC papers, possibly in the USA', async () => {
  await renderScreen();
  expect(
    screen.getByText(
      'OpenAI verifică răspunsurile la exercițiile de consolidare și lucrările BAC, inclusiv eseurile: textul răspunsului tău este trimis către OpenAI pentru evaluare și poate fi prelucrat în afara UE (în SUA).',
    ),
  ).toBeTruthy();
});

it('declares everything the app stores about the student', async () => {
  await renderScreen();
  for (const item of [
    'Progresul tău în lecții și răspunsurile la exercițiile de consolidare.',
    'Lucrările BAC: răspunsurile, eseurile și notele primite.',
    'Accesul complet: perioadele și istoricul obținerii lui.',
    'Un istoric al activității tale în aplicație (de exemplu când ai deschis aplicația sau ai terminat o lecție), folosit pentru suport și pentru siguranța contului.',
    'Data la care ai confirmat că ai cel puțin 14 ani (și, dacă ai sub 18 ani, că ai acordul părintelui sau al tutorelui) și versiunea termenilor acceptată.',
  ]) {
    expect(screen.getByText(item)).toBeTruthy();
  }
});

it('names the operator', async () => {
  await renderScreen();
  expect(screen.getAllByText(OPERATOR_NAME, { exact: false }).length).toBeGreaterThan(0);
});

it('links to the terms of use', async () => {
  await renderScreen();
  fireEvent.press(screen.getByText('Termeni de utilizare'));
  expect(router.push).toHaveBeenCalledWith('/termeni');
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

it('explains the credits data and the email fingerprint', async () => {
  await renderScreen();
  expect(
    screen.getByText('Păstrăm doar o amprentă ireversibilă a adresei de email, ca să știm că ai primit deja creditele de bun venit.', { exact: false }),
  ).toBeTruthy();
  expect(screen.getByText('Creditele: soldul, cumpărările de pachete și istoricul verificărilor.')).toBeTruthy();
});

it('explains the fingerprint kept when a suspended account is deleted or re-registration is blocked', async () => {
  await renderScreen();
  expect(
    screen.getByText(
      'Dacă un cont este șters în timp ce e suspendat sau dacă un administrator blochează reînregistrarea, păstrăm o amprentă ireversibilă a adresei de email și motivul, ca să nu poată fi creat un cont nou.',
    ),
  ).toBeTruthy();
});
