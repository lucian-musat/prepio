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
const MESSAGE = `Învață pentru BAC cu Prepio. Folosește linkul meu ca să te înregistrezi: ${LINK}`;
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
  expect(await screen.findByText('Încă 3 colegi care își iau abonament și primești 3 luni gratis')).toBeTruthy();
  expect(screen.getByText('2 din 5')).toBeTruthy();
  expect(screen.getByRole('progressbar')).toBeTruthy();
  expect(screen.getByText('ABCD2345')).toBeTruthy();
});

it('trial: singular colleague and one month', async () => {
  mockedSummary.mockResolvedValue(summary({ pendingCount: 4, durationMonths: 1 }));
  await mount();
  expect(await screen.findByText('Încă 1 coleg care își ia abonament și primești o lună gratis')).toBeTruthy();
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
  expect(await screen.findByText('Primești 40 de credite pentru fiecare coleg care își ia abonament')).toBeTruthy();
  expect(screen.getByText('Până acum: 3 abonați · 120 de credite câștigate')).toBeTruthy();
  expect(screen.queryByRole('progressbar')).toBeNull();
});

it('active access: totals leave out zero credits and count one free period', async () => {
  mockedRows.mockResolvedValue([row('1', { state: 'consumed_access' }), row('2', { state: 'consumed_access' })]);
  mockedSummary.mockResolvedValue(summary({ hasAccess: true, creditsEarned: 0, freePeriodsEarned: 1 }));
  await mount();
  expect(await screen.findByText('Până acum: 2 abonați · o perioadă de acces gratuit câștigată')).toBeTruthy();
});

it('active access: totals with credits and several free periods', async () => {
  mockedRows.mockResolvedValue([row('1', { state: 'consumed_access' }), row('2', { state: 'converted_credits', rewardCredits: 40 })]);
  mockedSummary.mockResolvedValue(summary({ hasAccess: true, creditsEarned: 40, freePeriodsEarned: 2 }));
  await mount();
  expect(await screen.findByText('Până acum: 2 abonați · 40 de credite câștigate · 2 perioade de acces gratuit câștigate')).toBeTruthy();
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
  expect(await screen.findByText('Cont creat, fără abonament')).toBeTruthy();
  expect(screen.getByText('ion@x.ro')).toBeTruthy();
  expect(screen.getAllByText('Abonat · numără spre abonamentul gratuit')).toHaveLength(2);
  expect(screen.getByText('Abonat · a contribuit la abonamentul gratuit')).toBeTruthy();
  expect(screen.getByText('Abonat · +40 de credite')).toBeTruthy();
  expect(screen.getByText('Abonat, fără recompensă (limita a fost atinsă)')).toBeTruthy();
  expect(screen.getByText('Abonat, fără recompensă')).toBeTruthy();
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
  expect(await screen.findByText('Înregistrat 10 noiembrie 2026')).toBeTruthy();
  // 23:30 UTC is already the next day in Bucharest.
  expect(screen.getByText('Înregistrat 10 noiembrie 2026 · Abonat din 11 noiembrie 2026')).toBeTruthy();
  expect(screen.queryByText(/Abonat din.*Ion/)).toBeNull();
});

it('cap reached: a quiet note, and no per-colleague promise', async () => {
  mockedSummary.mockResolvedValue(summary({ hasAccess: true, creditsEarned: 80, capReached: true, maxRewarded: 2 }));
  mockedRows.mockResolvedValue([
    row('1', { state: 'converted_credits', rewardCredits: 40 }),
    row('2', { state: 'converted_credits', rewardCredits: 40 }),
  ]);
  await mount();
  expect(await screen.findByText('Ai atins limita de invitați recompensați; colegii noi nu mai aduc recompense.')).toBeTruthy();
  expect(screen.queryByText(/pentru fiecare coleg care își ia abonament/)).toBeNull();
  expect(screen.getByText('Până acum: 2 abonați · 80 de credite câștigate')).toBeTruthy();
});

it('cap reached without access: the note replaces the free-period promise, the progress stays', async () => {
  mockedSummary.mockResolvedValue(summary({ capReached: true, pendingCount: 2 }));
  await mount();
  expect(await screen.findByText('Ai atins limita de invitați recompensați; colegii noi nu mai aduc recompense.')).toBeTruthy();
  expect(screen.queryByText(/primești 3 luni gratis/)).toBeNull();
  expect(screen.getByText('2 din 5')).toBeTruthy();
});

it('no cap note below the cap', async () => {
  mockedSummary.mockResolvedValue(summary({ hasAccess: true }));
  await mount();
  expect(await screen.findByText('Primești 40 de credite pentru fiecare coleg care își ia abonament')).toBeTruthy();
  expect(screen.queryByText(/Ai atins limita/)).toBeNull();
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
  await fireEvent.press(await screen.findByText('Cum funcționează ›'));
  expect(router.push).toHaveBeenCalledWith('/recomandari');
});
