import { act, fireEvent, render, screen } from '@testing-library/react-native';
import ReferralCodeField from './ReferralCodeField';
import {
  clearPendingCode,
  fetchReferralPublicSettings,
  getPendingCode,
  lookupReferralCode,
  storePendingCode,
} from '../lib/referrals';

jest.mock('../lib/referrals', () => ({
  ...jest.requireActual('../lib/referrals'),
  fetchReferralPublicSettings: jest.fn(),
  lookupReferralCode: jest.fn(),
  getPendingCode: jest.fn(),
  storePendingCode: jest.fn(),
  clearPendingCode: jest.fn(),
}));

const SETTINGS = { enabled: true, threshold: 3, creditsPerInvitee: 50, durationMonths: 6, maxRewarded: 10 };
const PRIVACY = 'Cel care te-a invitat va vedea prenumele și e-mailul tău.';

beforeEach(() => {
  jest.clearAllMocks();
  (fetchReferralPublicSettings as jest.Mock).mockResolvedValue(SETTINGS);
  (getPendingCode as jest.Mock).mockResolvedValue(null);
  (storePendingCode as jest.Mock).mockResolvedValue(undefined);
  (clearPendingCode as jest.Mock).mockResolvedValue(undefined);
  (lookupReferralCode as jest.Mock).mockResolvedValue({ valid: false, inviterFirstName: null });
});

const open = async () => {
  await fireEvent.press(await screen.findByText('Ai un cod de invitație?'));
  return screen.getByLabelText('Cod de invitație');
};

it('renders nothing when the programme is disabled', async () => {
  (fetchReferralPublicSettings as jest.Mock).mockResolvedValue({ ...SETTINGS, enabled: false });
  await render(<ReferralCodeField onChange={jest.fn()} />);
  await act(async () => {});
  expect(screen.queryByText('Ai un cod de invitație?')).toBeNull();
  expect(screen.queryByText(PRIVACY)).toBeNull();
});

it('renders nothing when the settings cannot be read', async () => {
  (fetchReferralPublicSettings as jest.Mock).mockRejectedValue(new Error('offline'));
  await render(<ReferralCodeField onChange={jest.fn()} />);
  await act(async () => {});
  expect(screen.queryByText('Ai un cod de invitație?')).toBeNull();
});

it('is collapsed, expands to an input, and shows the privacy line', async () => {
  await render(<ReferralCodeField onChange={jest.fn()} />);
  expect(await screen.findByText('Ai un cod de invitație?')).toBeTruthy();
  expect(screen.queryByLabelText('Cod de invitație')).toBeNull();
  await open();
  expect(screen.getByText(PRIVACY)).toBeTruthy();
});

it('a valid typed code shows the inviter, is stored and reported (upper-cased)', async () => {
  (lookupReferralCode as jest.Mock).mockResolvedValue({ valid: true, inviterFirstName: 'Ana' });
  const onChange = jest.fn();
  await render(<ReferralCodeField onChange={onChange} />);
  const input = await open();
  await fireEvent.changeText(input, 'ab-cd2345');
  await fireEvent(input, 'submitEditing');
  expect(await screen.findByText('Invitat de Ana ✓')).toBeTruthy();
  expect(lookupReferralCode).toHaveBeenCalledWith('ABCD2345');
  expect(storePendingCode).toHaveBeenCalledWith('ABCD2345');
  expect(onChange).toHaveBeenLastCalledWith('ABCD2345');
});

it('an invalid code gets a neutral message and reports null', async () => {
  const onChange = jest.fn();
  await render(<ReferralCodeField onChange={onChange} />);
  const input = await open();
  await fireEvent.changeText(input, 'zzzz9999');
  await fireEvent(input, 'submitEditing');
  expect(await screen.findByText('Codul nu este valid.')).toBeTruthy();
  expect(storePendingCode).not.toHaveBeenCalled();
  expect(onChange).toHaveBeenLastCalledWith(null);
});

it('a failed lookup never blocks: no message of an error kind, no code reported', async () => {
  (lookupReferralCode as jest.Mock).mockRejectedValue(new Error('offline'));
  const onChange = jest.fn();
  await render(<ReferralCodeField onChange={onChange} />);
  const input = await open();
  await fireEvent.changeText(input, 'ABCD2345');
  await fireEvent(input, 'submitEditing');
  expect(await screen.findByText('Nu am putut verifica codul acum.')).toBeTruthy();
  expect(onChange).toHaveBeenLastCalledWith(null);
});

it('editing a code clears the stored one', async () => {
  (lookupReferralCode as jest.Mock).mockResolvedValue({ valid: true, inviterFirstName: 'Ana' });
  await render(<ReferralCodeField onChange={jest.fn()} />);
  const input = await open();
  await fireEvent.changeText(input, 'ABCD2345');
  await fireEvent(input, 'submitEditing');
  await screen.findByText('Invitat de Ana ✓');
  await fireEvent.changeText(screen.getByLabelText('Cod de invitație'), 'ABCD234');
  expect(clearPendingCode).toHaveBeenCalled();
});

it('a valid pending code from the link shows the inviter instead of the collapsed link', async () => {
  (getPendingCode as jest.Mock).mockResolvedValue('ABCD2345');
  (lookupReferralCode as jest.Mock).mockResolvedValue({ valid: true, inviterFirstName: 'Ana' });
  const onChange = jest.fn();
  await render(<ReferralCodeField onChange={onChange} />);
  expect(await screen.findByText('Invitat de Ana ✓')).toBeTruthy();
  expect(screen.queryByText('Ai un cod de invitație?')).toBeNull();
  expect(screen.getByText(PRIVACY)).toBeTruthy();
  expect(onChange).toHaveBeenLastCalledWith('ABCD2345');
});

it('an invalid pending code is dropped and the field stays collapsed', async () => {
  (getPendingCode as jest.Mock).mockResolvedValue('OLD00000');
  const onChange = jest.fn();
  await render(<ReferralCodeField onChange={onChange} />);
  expect(await screen.findByText('Ai un cod de invitație?')).toBeTruthy();
  expect(clearPendingCode).toHaveBeenCalled();
  expect(onChange).not.toHaveBeenCalledWith('OLD00000');
});
