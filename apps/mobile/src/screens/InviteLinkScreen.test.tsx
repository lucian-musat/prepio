import { render, waitFor } from '@testing-library/react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import InviteLinkScreen from './InviteLinkScreen';
import { storePendingCode } from '../lib/referrals';
import { useAuth } from '../auth/AuthProvider';

jest.mock('expo-router', () => ({ Redirect: jest.fn(() => null), useLocalSearchParams: jest.fn() }));
jest.mock('../lib/referrals', () => ({ ...jest.requireActual('../lib/referrals'), storePendingCode: jest.fn() }));
jest.mock('../auth/AuthProvider', () => ({ useAuth: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  (storePendingCode as jest.Mock).mockResolvedValue(undefined);
  (useLocalSearchParams as jest.Mock).mockReturnValue({ code: 'ab-cd2345' });
  (useAuth as jest.Mock).mockReturnValue({ status: 'signedOut' });
});

it('stores the normalized code, then redirects to the start page', async () => {
  await render(<InviteLinkScreen />);
  await waitFor(() => expect(Redirect).toHaveBeenCalledWith({ href: '/' }, undefined));
  expect(storePendingCode).toHaveBeenCalledWith('ABCD2345');
  expect((storePendingCode as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
    (Redirect as jest.Mock).mock.invocationCallOrder[0],
  );
});

it('stores nothing for a signed-in student', async () => {
  (useAuth as jest.Mock).mockReturnValue({ status: 'ready' });
  await render(<InviteLinkScreen />);
  await waitFor(() => expect(Redirect).toHaveBeenCalledWith({ href: '/' }, undefined));
  expect(storePendingCode).not.toHaveBeenCalled();
});

it('stores nothing for an empty code', async () => {
  (useLocalSearchParams as jest.Mock).mockReturnValue({ code: '--' });
  await render(<InviteLinkScreen />);
  await waitFor(() => expect(Redirect).toHaveBeenCalledWith({ href: '/' }, undefined));
  expect(storePendingCode).not.toHaveBeenCalled();
});
