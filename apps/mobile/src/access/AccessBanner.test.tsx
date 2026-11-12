import { act, fireEvent, render, screen } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatAccessDate } from '@prepio/shared';
import AccessBanner, { BANNER_DISMISS_KEY, bucharestDay } from './AccessBanner';

jest.mock('../credits/CreditsProvider');
jest.mock('./AccessProvider');
const { mockResetCredits } = jest.requireMock<typeof import('../credits/__mocks__/CreditsProvider')>('../credits/CreditsProvider');
const { mockResetAccess } = jest.requireMock<typeof import('./__mocks__/AccessProvider')>('./AccessProvider');

const DAY = 86400000;
const inDays = (n: number) => new Date(Date.now() + n * DAY - 60_000).toISOString();

beforeEach(async () => {
  await AsyncStorage.clear();
  mockResetCredits(18);
  mockResetAccess();
});

const mount = async () => {
  const onOffer = jest.fn();
  await render(<AccessBanner onOffer={onOffer} />);
  await act(async () => {}); // the stored dismissal is read
  return onOffer;
};

it('trial: the offer and „Vezi oferta · 150 lei”, without a close button', async () => {
  const onOffer = await mount();
  expect(
    screen.getByText('Ești în perioada de probă. Acum ai deschisă doar prima lecție. Deschide-le pe toate pentru 3 luni, plus 100 de credite.'),
  ).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Vezi oferta · 150 lei' }));
  expect(onOffer).toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Ascunde până mâine' })).toBeNull();
});

it('expired: the end date, the credits kept and „Reînnoiește · 150 lei”', async () => {
  const until = inDays(-3);
  const onOffer = await mount();
  await act(async () => mockResetAccess({ accessUntil: until }));
  expect(
    screen.getByText(
      `Accesul tău a expirat pe ${formatAccessDate(new Date(until))}. Progresul și cele 18 credite rămân ale tale. Reînnoiește ca să redeschizi toate lecțiile.`,
    ),
  ).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Reînnoiește · 150 lei' }));
  expect(onOffer).toHaveBeenCalled();
});

it('full access and admins: no banner', async () => {
  mockResetAccess({ accessUntil: inDays(40) });
  await mount();
  expect(screen.queryByTestId('access-banner')).toBeNull();
  await act(async () => mockResetAccess({ isAdmin: true }));
  expect(screen.queryByTestId('access-banner')).toBeNull();
});

it('expiring: the renewal banner; closing hides it for the rest of the Bucharest day', async () => {
  const until = inDays(5);
  mockResetAccess({ accessUntil: until });
  await mount();
  expect(
    await screen.findByText(
      `Accesul tău expiră în 5 zile (${formatAccessDate(new Date(until))}). Reînnoiește acum: primești încă 3 luni, adăugate la zilele rămase, și +100 de credite.`,
    ),
  ).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Reînnoiește · 150 lei' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Ascunde până mâine' }));
  expect(screen.queryByTestId('access-banner')).toBeNull();
  expect(await AsyncStorage.getItem(BANNER_DISMISS_KEY)).toBe(bucharestDay(new Date()));
  await screen.unmount();
  await mount();
  expect(screen.queryByTestId('access-banner')).toBeNull();
});

it('expiring: a dismissal from an earlier day does not hide it', async () => {
  await AsyncStorage.setItem(BANNER_DISMISS_KEY, bucharestDay(new Date(Date.now() - DAY)));
  mockResetAccess({ accessUntil: inDays(2) });
  await mount();
  expect(await screen.findByTestId('access-banner')).toBeTruthy();
});

it('storage failing: the banner still renders and can still be closed', async () => {
  // The jest mock's functions are jest.fn already: one failing call each, nothing to restore.
  (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('denied'));
  (AsyncStorage.setItem as jest.Mock).mockImplementationOnce(() => {
    throw new Error('denied');
  });
  mockResetAccess({ accessUntil: inDays(3) });
  await mount();
  expect(await screen.findByTestId('access-banner')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Ascunde până mâine' }));
  expect(screen.queryByTestId('access-banner')).toBeNull();
});

it('one day left reads „1 zi”; no bonus leaves the credits out', async () => {
  mockResetAccess({ accessUntil: inDays(1), offer: { priceBani: 15000, bonusCredits: 0, durationMonths: 1 } });
  await mount();
  expect(await screen.findByText(/^Accesul tău expiră în 1 zi \(.*\)\. Reînnoiește acum: primești încă 1 lună, adăugată la zilele rămase\.$/)).toBeTruthy();
});

it('bucharestDay uses the Bucharest calendar day', () => {
  expect(bucharestDay(new Date('2026-11-08T22:30:00Z'))).toBe('2026-11-09'); // 00:30 in Bucharest (UTC+2)
  expect(bucharestDay(new Date('2026-11-08T21:30:00Z'))).toBe('2026-11-08');
});
