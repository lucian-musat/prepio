import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { color, feedbackText, planTone } from '@prepio/shared';
import CreditChip from './CreditChip';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('./CreditsProvider');
jest.mock('../access/AccessProvider');
const { mockResetCredits, setBalance } = jest.requireMock<typeof import('./__mocks__/CreditsProvider')>('./CreditsProvider');
const { mockResetAccess } = jest.requireMock<typeof import('../access/__mocks__/AccessProvider')>('../access/AccessProvider');

const DAY = 24 * 3600 * 1000;
const inDays = (n: number) => new Date(Date.now() + n * DAY - 60_000).toISOString();

beforeEach(() => {
  mockResetCredits(12);
  mockResetAccess();
  (router.push as jest.Mock).mockReset();
});

const pill = () => screen.getByTestId('credit-chip');
const bg = () => StyleSheet.flatten(pill().props.style).backgroundColor;

it('trial: „Trial · 12” in the neutral tone, with the label', async () => {
  await render(<CreditChip />);
  expect(screen.getByRole('button', { name: 'Trial, 12 credite, deschide abonamentul' })).toBeTruthy();
  expect(screen.getByText('Trial ·')).toBeTruthy();
  expect(screen.getByText('12')).toBeTruthy();
  expect(bg()).toBe(planTone.trial.bg);
});

it('expired looks like the trial', async () => {
  mockResetAccess({ accessUntil: inDays(-3) });
  await render(<CreditChip />);
  expect(screen.getByText('Trial ·')).toBeTruthy();
  expect(bg()).toBe(planTone.trial.bg);
  expect(screen.getByLabelText('Trial, 12 credite, deschide abonamentul')).toBeTruthy();
});

it('full access: „★ · 12” in green', async () => {
  mockResetAccess({ accessUntil: inDays(40) });
  await render(<CreditChip />);
  expect(screen.getByText('★ ·')).toBeTruthy();
  expect(bg()).toBe(planTone.full.bg);
  expect(screen.getByLabelText('Acces complet, 12 credite, deschide abonamentul')).toBeTruthy();
});

it('expiring: „⏳ 5 zile · 12” in orange; one day is „1 zi”', async () => {
  mockResetAccess({ accessUntil: inDays(5) });
  await render(<CreditChip />);
  expect(screen.getByText('⏳ 5 zile ·')).toBeTruthy();
  expect(bg()).toBe(planTone.expiring.bg);
  expect(screen.getByLabelText('Acces complet încă 5 zile, 12 credite, deschide abonamentul')).toBeTruthy();
  await act(async () => mockResetAccess({ accessUntil: inDays(1) }));
  expect(screen.getByText('⏳ 1 zi ·')).toBeTruthy();
});

it('an admin sees the full style', async () => {
  mockResetAccess({ isAdmin: true });
  await render(<CreditChip />);
  expect(screen.getByText('★ ·')).toBeTruthy();
  expect(bg()).toBe(planTone.full.bg);
});

it('turns the danger tone when the balance is below need', async () => {
  mockResetCredits(7);
  await render(<CreditChip need={8} />);
  expect(bg()).toBe(color.dangerSubtle);
  expect(StyleSheet.flatten(screen.getByText('7').props.style).color).toBe(feedbackText.wrong);
});

it('renders nothing while the balance is null', async () => {
  mockResetCredits(null);
  await render(<CreditChip />);
  expect(screen.queryByTestId('credit-chip')).toBeNull();
});

it('opens „Abonamentul meu” on press', async () => {
  await render(<CreditChip />);
  await fireEvent.press(pill());
  expect(router.push).toHaveBeenCalledWith('/abonament');
});

it('floats the change delta when a change arrives', async () => {
  await render(<CreditChip />);
  await act(async () => setBalance(10));
  expect(screen.getByText('−2')).toBeTruthy();
});

it('prefixes a gain with +', async () => {
  await render(<CreditChip />);
  await act(async () => setBalance(112));
  expect(screen.getByText('+100')).toBeTruthy();
});
