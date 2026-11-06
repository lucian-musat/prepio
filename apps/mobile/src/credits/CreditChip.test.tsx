import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { color, feedbackText } from '@prepio/shared';
import CreditChip from './CreditChip';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
let mockCredits: { balance: number | null; change: { delta: number; id: number } | null };
jest.mock('./CreditsProvider', () => ({ useCredits: () => mockCredits }));

beforeEach(() => {
  mockCredits = { balance: 7, change: null };
  (router.push as jest.Mock).mockReset();
});

const bg = () => StyleSheet.flatten(screen.getByTestId('credit-chip').props.style).backgroundColor;

it('shows the balance with the accessible label, in the default tone', async () => {
  await render(<CreditChip need={2} />);
  expect(screen.getByLabelText('Ai 7 credite. Deschide creditele mele.')).toBeTruthy();
  expect(screen.getByText('7')).toBeTruthy();
  expect(bg()).toBe(color.accentSubtle);
});

it('turns the danger tone when the balance is below need', async () => {
  await render(<CreditChip need={8} />);
  expect(bg()).toBe(color.dangerSubtle);
  expect(StyleSheet.flatten(screen.getByText('7').props.style).color).toBe(feedbackText.wrong);
});

it('renders nothing while the balance is null', async () => {
  mockCredits = { balance: null, change: null };
  await render(<CreditChip />);
  expect(screen.queryByTestId('credit-chip')).toBeNull();
});

it('opens the credits page on press', async () => {
  await render(<CreditChip />);
  await fireEvent.press(screen.getByRole('button', { name: 'Ai 7 credite. Deschide creditele mele.' }));
  expect(router.push).toHaveBeenCalledWith('/credits');
});

it('floats the change delta when a change arrives', async () => {
  mockCredits = { balance: 7, change: null };
  await render(<CreditChip />);
  mockCredits = { balance: 5, change: { delta: -2, id: 1 } };
  await screen.rerender(<CreditChip />);
  expect(screen.getByText('−2')).toBeTruthy();
});

it('prefixes a gain with +', async () => {
  mockCredits = { balance: 7, change: null };
  await render(<CreditChip />);
  mockCredits = { balance: 57, change: { delta: 50, id: 1 } };
  await screen.rerender(<CreditChip />);
  expect(screen.getByText('+50')).toBeTruthy();
});
