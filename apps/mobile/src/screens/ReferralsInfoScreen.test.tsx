import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ReferralsInfoScreen from './ReferralsInfoScreen';
import { CONTACT_EMAIL } from '../lib/legal';
import { fetchReferralPublicSettings, type ReferralPublicSettings } from '../lib/referrals';

jest.mock('../lib/referrals', () => ({
  ...jest.requireActual('../lib/referrals'),
  fetchReferralPublicSettings: jest.fn(),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true } }));
const mocked = fetchReferralPublicSettings as jest.Mock;

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const mount = async () =>
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ReferralsInfoScreen />
    </SafeAreaProvider>,
  );
/** The sections after „Pe scurt” start closed: open them all, so the copy can be checked. */
const openAll = async () => {
  await screen.findByText('Pe scurt');
  for (const b of screen.queryAllByRole('button').filter((x) => x.props.accessibilityState?.expanded === false)) {
    await fireEvent.press(b);
  }
};
const settings = (over: Partial<ReferralPublicSettings> = {}): ReferralPublicSettings => ({
  enabled: true,
  threshold: 5,
  creditsPerInvitee: 40,
  durationMonths: 3,
  maxRewarded: 100,
  bonusCredits: 100,
  ...over,
});

const HEADINGS = [
  'Pe scurt',
  'Cine este un coleg care a plătit',
  'Dacă nu ai acces activ (probă sau expirat)',
  'Dacă ai acces activ',
  'Dacă îți cumperi tu acces',
  'Exemple',
  'Cum se folosește codul',
  'Reguli importante',
  'Ce vede cel care te-a invitat',
  'Unde vezi recomandările',
  'Dacă Prepio oprește recomandările',
  'Întrebări frecvente',
  'Cui te adresezi',
];
const QUESTIONS = [
  'Invitatul a plătit după ce mi-am cumpărat eu accesul',
  'Accesul meu a expirat',
  'Invitatul și-a șters contul',
  'Pot introduce codul după ce m-am înregistrat?',
  'De ce nu apare invitatul în listă?',
];
const all = (re: RegExp) => screen.getAllByText(re).length > 0;

beforeEach(() => {
  jest.clearAllMocks();
  mocked.mockResolvedValue(settings());
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

it('shows a spinner while the numbers load, then the page', async () => {
  let resolve!: (s: ReferralPublicSettings) => void;
  mocked.mockReturnValue(new Promise((r) => (resolve = r)));
  await mount();
  expect(screen.getByLabelText('Se încarcă')).toBeTruthy();
  await act(async () => resolve(settings()));
  expect(await screen.findByText('Pe scurt')).toBeTruthy();
  expect(screen.queryByLabelText('Se încarcă')).toBeNull();
});

it('has every required topic heading, in order, and the FAQ questions', async () => {
  await mount();
  await openAll();
  await screen.findByText('Pe scurt');
  const headers = screen.getAllByRole('header').map((h) => h.props.children);
  expect(headers.filter((h) => HEADINGS.includes(h))).toEqual(HEADINGS);
  for (const q of QUESTIONS) expect(screen.getByText(q)).toBeTruthy();
});

it('renders the live numbers (5 colleagues, 40 credits, 3 months, cap 100)', async () => {
  await mount();
  await openAll();
  await screen.findByText('Pe scurt');
  expect(all(/5 colegi/)).toBe(true);
  expect(all(/40 de credite/)).toBe(true);
  expect(all(/3 luni/)).toBe(true);
  expect(all(/cel mult 100 de colegi/)).toBe(true);
  expect(all(/2 × 40 de credite = 80 de credite/)).toBe(true);
});

it('uses the singular forms (1 colleague, 1 credit, one month, cap 1)', async () => {
  mocked.mockResolvedValue(settings({ threshold: 1, creditsPerInvitee: 1, durationMonths: 1, maxRewarded: 1 }));
  await mount();
  await openAll();
  await screen.findByText('Pe scurt');
  expect(all(/1 coleg\b/)).toBe(true);
  expect(all(/1 credit\b/)).toBe(true);
  expect(all(/o lună/)).toBe(true);
  expect(all(/cel mult 1 coleg\b/)).toBe(true);
  expect(screen.queryByText(/1 colegi/)).toBeNull();
  expect(screen.queryByText(/1 credite/)).toBeNull();
  expect(screen.queryByText(/1 luni/)).toBeNull();
});

it('follows the settings when they change (other numbers, the "de" rule)', async () => {
  mocked.mockResolvedValue(settings({ threshold: 20, creditsPerInvitee: 21, durationMonths: 12, maxRewarded: 25 }));
  await mount();
  await openAll();
  await screen.findByText('Pe scurt');
  expect(all(/20 de colegi/)).toBe(true);
  expect(all(/21 de credite/)).toBe(true);
  expect(all(/12 luni/)).toBe(true);
  expect(all(/cel mult 25 de colegi/)).toBe(true);
  expect(screen.queryByText(/5 colegi/)).toBeNull();
});

it('says what the free access is: same as a purchase, with the same bonus credits (live number)', async () => {
  await mount();
  await openAll();
  await screen.findByText('Pe scurt');
  expect(all(/la fel ca un acces cumpărat: aceleași lecții, aceleași funcții și aceleași credite bonus incluse \(acum 100 de credite\)/)).toBe(true);
  expect(all(/cu 100 de credite bonus incluse/)).toBe(true);
  expect(screen.queryByText(/fără credite bonus/)).toBeNull();
  expect(screen.queryByText(/nu vine cu credite bonus/)).toBeNull();
});

it('follows the bonus setting: another number, none, or unknown', async () => {
  mocked.mockResolvedValue(settings({ bonusCredits: 1 }));
  const first = await mount();
  await openAll();
  await screen.findByText('Pe scurt');
  expect(all(/aceleași credite bonus incluse \(acum 1 credit\)/)).toBe(true);
  await first.unmount();
  mocked.mockResolvedValue(settings({ bonusCredits: 0 }));
  const second = await mount();
  await openAll();
  await screen.findByText('Pe scurt');
  expect(all(/Acum accesul cumpărat nu include credite bonus, deci nici accesul gratuit/)).toBe(true);
  expect(screen.queryByText(/credite bonus incluse/)).toBeNull();
  await second.unmount();
  mocked.mockRejectedValue(new Error('offline'));
  await mount();
  await openAll();
  await screen.findByText('Pe scurt');
  expect(all(/aceleași credite bonus incluse ca la o cumpărare/)).toBe(true);
});

it('covers the rules the database enforces', async () => {
  await mount();
  await openAll();
  await screen.findByText('Pe scurt');
  expect(all(/Accesul primit de la un administrator nu contează/)).toBe(true);
  expect(all(/doar prima cumpărare/i)).toBe(true);
  expect(all(/nu expiră/)).toBe(true);
  expect(all(/O singură persoană te poate invita/)).toBe(true);
  expect(all(/în ultimele 24 de ore/)).toBe(true);
  expect(all(/mai vechi decât/)).toBe(true);
  expect(all(/Nu pierzi recompensa/)).toBe(true);
  expect(all(/limita a fost atinsă/)).toBe(true);
  expect(all(/prenumele și adresa de e-mail/)).toBe(true);
  expect(all(/Istoricul creditelor/)).toBe(true);
  expect(all(/Istoricul accesului/)).toBe(true);
  expect(all(new RegExp(CONTACT_EMAIL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBe(true);
});

it('is graceful when the settings cannot be read: no numbers, no crash', async () => {
  mocked.mockRejectedValue(new Error('offline'));
  await mount();
  await openAll();
  expect(await screen.findByText('Pe scurt')).toBeTruthy();
  expect(all(/numărul de colegi stabilit de Prepio/)).toBe(true);
  expect(all(/numărul de credite stabilit de Prepio/)).toBe(true);
  expect(all(/perioada stabilită de Prepio/)).toBe(true);
  expect(screen.queryByText(/\d+ colegi/)).toBeNull();
  expect(all(/Exemplele cu cifre apar când/)).toBe(true);
  expect(screen.queryByText('Recomandările nu sunt active acum.')).toBeNull();
});

it('when the programme is off: a notice at the top, the page stays readable', async () => {
  mocked.mockResolvedValue(settings({ enabled: false }));
  await mount();
  await openAll();
  expect(await screen.findByText('Recomandările nu sunt active acum.')).toBeTruthy();
  expect(screen.getByText('Pe scurt')).toBeTruthy();
  expect(all(/5 colegi/)).toBe(true);
});

it('does not show the off notice while the programme is on', async () => {
  await mount();
  await openAll();
  await screen.findByText('Pe scurt');
  expect(screen.queryByText('Recomandările nu sunt active acum.')).toBeNull();
});

it('tells what happens to waiting colleagues when the inviter buys, and when the programme is off', async () => {
  await mount();
  await openAll();
  await screen.findByText('Pe scurt');
  expect(all(/Cât timp recomandările sunt pornite, colegii care așteaptă la tine se transformă în credite/)).toBe(true);
  expect(
    all(/Dacă îți cumperi acces cât timp recomandările sunt oprite, colegii care așteaptă nu se transformă în credite; rămân la rând și se transformă la o cumpărare următoare, făcută cât timp recomandările sunt pornite\./),
  ).toBe(true);
  expect(all(/data înregistrării tale, data plății/)).toBe(true);
  expect(all(/nu au fost încă numărați/)).toBe(true);
  // Every buy-conversion sentence carries the programme-on qualifier.
  expect(all(/Dacă îți cumperi acces nou cât timp recomandările sunt pornite, se transformă în credite/)).toBe(true);
  expect(all(/până îți cumperi acces cât timp recomandările sunt pornite/)).toBe(true);
  expect(all(/Când Ioana își cumpără și ea acces, cât timp recomandările sunt pornite/)).toBe(true);
  expect(screen.queryByText(/Dacă îți cumperi acces nou, se transformă în credite/)).toBeNull();
  expect(screen.queryByText(/prietenul/)).toBeNull();
});

it('starts with „Pe scurt” open and every other section closed', async () => {
  mocked.mockResolvedValue(settings());
  await mount();
  await screen.findByText('Pe scurt');
  const fold = screen.getByRole('button', { name: 'Reguli importante' });
  expect(fold.props.accessibilityState).toMatchObject({ expanded: false });
  expect(screen.queryByText('Un coleg nu aduce recompensă de două ori.')).toBeNull();
  await fireEvent.press(fold);
  expect(screen.getByText('Un coleg nu aduce recompensă de două ori.')).toBeTruthy();
});
