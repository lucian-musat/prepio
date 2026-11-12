import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Dimensions, Platform, Share, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { fetchMyReferrals, fetchReferralSummary, type ReferralRow, type ReferralSummary } from '../lib/referrals';
import { router } from 'expo-router';
import InviteScreen from './InviteScreen';

jest.mock('../lib/referrals', () => ({
  ...jest.requireActual('../lib/referrals'),
  fetchReferralSummary: jest.fn(),
  fetchMyReferrals: jest.fn(),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text>{`redirect:${href}`}</Text>;
  },
}));
const mockedSummary = fetchReferralSummary as jest.Mock;
const mockedRows = fetchMyReferrals as jest.Mock;

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const mount = async () =>
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <InviteScreen />
    </SafeAreaProvider>,
  );

const summary = (over: Partial<ReferralSummary> = {}): ReferralSummary => ({
  code: 'ABCD2345',
  enabled: true,
  threshold: 5,
  creditsPerInvitee: 40,
  durationMonths: 3,
  hasAccess: false,
  pendingCount: 2,
  inviteeCount: 2,
  creditsEarned: 0,
  freePeriodsEarned: 0,
  maxRewarded: 100,
  capReached: false,
  ...over,
});
const row = (id: string, over: Partial<ReferralRow> = {}): ReferralRow => ({
  id,
  firstName: 'Ana',
  email: 'ana@x.ro',
  state: 'pending',
  createdAt: '2026-11-10T10:00:00Z',
  firstPaidAt: null,
  rewardCredits: 0,
  accountDeleted: false,
  ...over,
});

const LINK = 'https://prepio.ro/invita/ABCD2345';
const MESSAGE = `Învăț pentru BAC cu Prepio. Dacă vrei să încerci și tu, fă-ți cont cu linkul meu: ${LINK}`;
const originalOS = Platform.OS;
const nav = globalThis as unknown as { navigator: Record<string, unknown> };
let originalNavigator: unknown;

beforeEach(() => {
  jest.clearAllMocks();
  mockedSummary.mockResolvedValue(summary());
  mockedRows.mockResolvedValue([]);
  originalNavigator = nav.navigator;
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  Platform.OS = originalOS;
  nav.navigator = originalNavigator as Record<string, unknown>;
});

it('trial: tells how many more colleagues earn the free period, with progress', async () => {
  await mount();
  expect(await screen.findByText('Mai ai nevoie de 3 colegi care să-și cumpere acces și primești 3 luni gratis')).toBeTruthy();
  expect(screen.getByText('2 din 5')).toBeTruthy();
  expect(screen.getByRole('progressbar')).toBeTruthy();
  expect(screen.getByText('ABCD2345')).toBeTruthy();
});

it('explains the three steps, with the reward that applies to this student', async () => {
  await mount();
  expect(await screen.findByText('Trimiți linkul tău colegilor.')).toBeTruthy();
  expect(screen.getByText('Își fac cont cu el.')).toBeTruthy();
  expect(screen.getByText('Când 5 dintre ei își cumpără acces, primești 3 luni gratis.')).toBeTruthy();
});

it('explains the credits reward when the student has access', async () => {
  mockedSummary.mockResolvedValue(summary({ hasAccess: true }));
  await mount();
  expect(await screen.findByText('Pentru fiecare coleg care își cumpără acces primești 40 de credite.')).toBeTruthy();
});

it('trial: singular colleague and one month', async () => {
  mockedSummary.mockResolvedValue(summary({ pendingCount: 4, durationMonths: 1 }));
  await mount();
  expect(await screen.findByText('Mai ai nevoie de 1 coleg care să-și cumpere acces și primești o lună gratis')).toBeTruthy();
});

it('active access: credits per colleague and totals', async () => {
  mockedSummary.mockResolvedValue(summary({ hasAccess: true, creditsEarned: 120, pendingCount: 0 }));
  mockedRows.mockResolvedValue([
    row('1', { state: 'converted_credits', rewardCredits: 40 }),
    row('2', { state: 'converted_credits', rewardCredits: 40 }),
    row('3', { state: 'converted_credits', rewardCredits: 40 }),
    row('4', { state: 'registered' }),
  ]);
  await mount();
  // The steps above already state the reward: the summary only counts.
  expect(await screen.findByText('Până acum: 3 colegi cu acces · 120 de credite câștigate')).toBeTruthy();
  expect(screen.getAllByText(/primești 40 de credite/i)).toHaveLength(1);
  expect(screen.queryByRole('progressbar')).toBeNull();
});

it('active access: totals leave out zero credits and count one free period', async () => {
  mockedRows.mockResolvedValue([row('1', { state: 'consumed_access' }), row('2', { state: 'consumed_access' })]);
  mockedSummary.mockResolvedValue(summary({ hasAccess: true, creditsEarned: 0, freePeriodsEarned: 1 }));
  await mount();
  expect(await screen.findByText('Până acum: 2 colegi cu acces · o perioadă de acces gratuit câștigată')).toBeTruthy();
});

it('active access: totals with credits and several free periods', async () => {
  mockedRows.mockResolvedValue([row('1', { state: 'consumed_access' }), row('2', { state: 'converted_credits', rewardCredits: 40 })]);
  mockedSummary.mockResolvedValue(summary({ hasAccess: true, creditsEarned: 40, freePeriodsEarned: 2 }));
  await mount();
  expect(await screen.findByText('Până acum: 2 colegi cu acces · 40 de credite câștigate · 2 perioade de acces gratuit câștigate')).toBeTruthy();
});

const copyButtonsStyle = async (width: number) => {
  mockedSummary.mockResolvedValue(summary());
  mockedRows.mockResolvedValue([]);
  const spy = jest.spyOn(Dimensions, 'get').mockReturnValue({ width, height: 800, scale: 1, fontScale: 1 });
  try {
    await mount();
    return StyleSheet.flatten((await screen.findByTestId('invite-copy-buttons')).props.style);
  } finally {
    spy.mockRestore();
  }
};

it('on a narrow screen the copy buttons stack so their labels fit', async () => {
  expect((await copyButtonsStyle(360)).flexDirection).toBeUndefined();
});

it('on a wide screen the copy buttons sit side by side', async () => {
  expect((await copyButtonsStyle(1000)).flexDirection).toBe('row');
});

it('lists invitees with a status each, and marks deleted accounts', async () => {
  mockedRows.mockResolvedValue([
    row('1', { state: 'registered', firstName: 'Ion', email: 'ion@x.ro' }),
    row('2', { state: 'pending' }),
    row('3', { state: 'consumed_access', firstName: 'Dan', email: 'dan@x.ro' }),
    row('4', { state: 'converted_credits', rewardCredits: 40, firstName: 'Eva', email: 'eva@x.ro' }),
    row('5', { state: 'over_cap', firstName: 'Mia', email: 'mia@x.ro' }),
    row('6', { state: 'not_rewarded_disabled', firstName: null, email: 'x@x.ro' }),
    row('7', { state: 'pending', firstName: 'Radu', email: null, accountDeleted: true }),
  ]);
  await mount();
  expect(await screen.findByText('Și-a făcut cont, încă fără acces')).toBeTruthy();
  expect(screen.getByText('ion@x.ro')).toBeTruthy();
  expect(screen.getAllByText('Are acces · se numără pentru accesul tău gratuit')).toHaveLength(2);
  expect(screen.getByText('Are acces · a contat pentru accesul tău gratuit')).toBeTruthy();
  expect(screen.getByText('Are acces · +40 de credite')).toBeTruthy();
  expect(screen.getByText('Are acces · fără recompensă (ai atins limita)')).toBeTruthy();
  expect(screen.getByText('Are acces · fără recompensă')).toBeTruthy();
  expect(screen.getByText('Coleg')).toBeTruthy();
  expect(screen.getByText('Radu · cont șters')).toBeTruthy();
  expect(screen.queryByText('null')).toBeNull();
});

it('shows when each invitee registered and, once paid, since when they subscribe', async () => {
  mockedRows.mockResolvedValue([
    row('1', { state: 'registered', firstName: 'Ion', createdAt: '2026-11-10T10:00:00Z' }),
    row('2', { state: 'converted_credits', rewardCredits: 40, firstName: 'Eva', createdAt: '2026-11-09T23:30:00Z', firstPaidAt: '2026-11-11T08:00:00Z' }),
  ]);
  await mount();
  expect(await screen.findByText('Cont creat pe 10 noiembrie 2026')).toBeTruthy();
  // 23:30 UTC is already the next day in Bucharest.
  expect(screen.getByText('Cont creat pe 10 noiembrie 2026 · acces din 11 noiembrie 2026')).toBeTruthy();
  expect(screen.queryByText(/acces din.*Ion/)).toBeNull();
});

it('cap reached: a quiet note, and no per-colleague promise', async () => {
  mockedSummary.mockResolvedValue(summary({ hasAccess: true, creditsEarned: 80, capReached: true, maxRewarded: 2 }));
  mockedRows.mockResolvedValue([
    row('1', { state: 'converted_credits', rewardCredits: 40 }),
    row('2', { state: 'converted_credits', rewardCredits: 40 }),
  ]);
  await mount();
  expect(await screen.findByText('Ai ajuns la numărul maxim de colegi pentru care primești recompense. Îi poți invita în continuare, dar fără recompensă.')).toBeTruthy();
  expect(screen.queryByText(/pentru fiecare coleg care își cumpără acces/)).toBeNull();
  expect(screen.getByText('Până acum: 2 colegi cu acces · 80 de credite câștigate')).toBeTruthy();
});

it('cap reached without access: the note replaces the free-period promise, the progress stays', async () => {
  mockedSummary.mockResolvedValue(summary({ capReached: true, pendingCount: 2 }));
  await mount();
  expect(await screen.findByText('Ai ajuns la numărul maxim de colegi pentru care primești recompense. Îi poți invita în continuare, dar fără recompensă.')).toBeTruthy();
  expect(screen.queryByText(/primești 3 luni gratis/)).toBeNull();
  expect(screen.getByText('2 din 5')).toBeTruthy();
});

it('no cap note below the cap', async () => {
  mockedSummary.mockResolvedValue(summary({ hasAccess: true }));
  await mount();
  expect(await screen.findByText('Pentru fiecare coleg care își cumpără acces primești 40 de credite.')).toBeTruthy();
  expect(screen.queryByText(/numărul maxim de colegi/)).toBeNull();
});

it('empty list', async () => {
  await mount();
  expect(await screen.findByText('Încă nu ai invitat pe nimeni. Trimite linkul de mai sus.')).toBeTruthy();
});

it('error state retries', async () => {
  mockedSummary.mockRejectedValueOnce(new Error('down'));
  await mount();
  expect(await screen.findByText('Nu am putut încărca invitațiile.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Reîncearcă' }));
  expect(await screen.findByText('ABCD2345')).toBeTruthy();
});

it('disabled feature or no code redirects home', async () => {
  mockedSummary.mockResolvedValue(summary({ enabled: false }));
  const { unmount } = await mount();
  expect(await screen.findByText('redirect:/')).toBeTruthy();
  await unmount();
  mockedSummary.mockResolvedValue(summary({ code: null }));
  await mount();
  expect(await screen.findByText('redirect:/')).toBeTruthy();
});

it('native: shares the prefilled message through the share sheet', async () => {
  Platform.OS = 'ios';
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction', activityType: undefined });
  await mount();
  { const el = await screen.findByRole('button', { name: 'Trimite linkul' }); await fireEvent.press(el); }
  expect(share).toHaveBeenCalledWith({ message: MESSAGE });
});

it('web: uses navigator.share when available', async () => {
  Platform.OS = 'web';
  const share = jest.fn().mockResolvedValue(undefined);
  nav.navigator = { share };
  await mount();
  { const el = await screen.findByRole('button', { name: 'Trimite linkul' }); await fireEvent.press(el); }
  expect(share).toHaveBeenCalledWith({ text: MESSAGE });
});

it('web: falls back to copying when navigator.share is missing, with visible feedback', async () => {
  Platform.OS = 'web';
  const writeText = jest.fn().mockResolvedValue(undefined);
  nav.navigator = { clipboard: { writeText } };
  await mount();
  { const el = await screen.findByRole('button', { name: 'Trimite linkul' }); await fireEvent.press(el); }
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(MESSAGE));
  expect(await screen.findByText('Copiat ✓')).toBeTruthy();
});

it('web: copies the link and the code separately', async () => {
  Platform.OS = 'web';
  const writeText = jest.fn().mockResolvedValue(undefined);
  nav.navigator = { clipboard: { writeText } };
  await mount();
  { const el = await screen.findByRole('button', { name: 'Copiază linkul' }); await fireEvent.press(el); }
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(LINK));
  await fireEvent.press(screen.getByRole('button', { name: 'Copiază codul' }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith('ABCD2345'));
});

it('web: a cancelled share is not an error and a failed copy says so', async () => {
  Platform.OS = 'web';
  nav.navigator = { share: jest.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' })) };
  await mount();
  { const el = await screen.findByRole('button', { name: 'Trimite linkul' }); await fireEvent.press(el); }
  await act(async () => {});
  expect(screen.queryByText('Copiat ✓')).toBeNull();
  expect(screen.queryByText('Nu am putut copia.')).toBeNull();
  nav.navigator = {};
  await fireEvent.press(screen.getByRole('button', { name: 'Copiază codul' }));
  expect(await screen.findByText('Nu am putut copia.')).toBeTruthy();
});

it('links to the explainer page', async () => {
  await mount();
  await fireEvent.press(await screen.findByText('Toate regulile ›'));
  expect(router.push).toHaveBeenCalledWith('/recomandari');
});
