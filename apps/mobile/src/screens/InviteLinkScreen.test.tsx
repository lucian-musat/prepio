import { render, waitFor } from '@testing-library/react-native';
import { Redirect, useLocalSearchParams, useNavigation } from 'expo-router';
import InviteLinkScreen from './InviteLinkScreen';
import { storePendingCode } from '../lib/referrals';
import { useAuth } from '../auth/AuthProvider';

jest.mock('expo-router', () => ({ Redirect: jest.fn(() => null), useLocalSearchParams: jest.fn(), useNavigation: jest.fn() }));

/** The screen's navigation, its Stack's route and the root route above it (expo-router puts the link params on both). */
function navChain() {
  const root = { setParams: jest.fn(), getParent: () => undefined };
  const stack = { setParams: jest.fn(), getParent: () => root };
  return { screen: { setParams: jest.fn(), getParent: () => stack }, stack, root };
}
jest.mock('../lib/referrals', () => ({ ...jest.requireActual('../lib/referrals'), storePendingCode: jest.fn() }));
jest.mock('../auth/AuthProvider', () => ({ useAuth: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  (storePendingCode as jest.Mock).mockResolvedValue(undefined);
  (useLocalSearchParams as jest.Mock).mockReturnValue({ code: 'ab-cd2345' });
  (useAuth as jest.Mock).mockReturnValue({ status: 'signedOut' });
  (useNavigation as jest.Mock).mockReturnValue(navChain().screen);
});

it('clears the code from the ancestor routes before redirecting, so the start page URL has no ?code=', async () => {
  const chain = navChain();
  (useNavigation as jest.Mock).mockReturnValue(chain.screen);
  await render(<InviteLinkScreen />);
  await waitFor(() => expect(Redirect).toHaveBeenCalledWith({ href: '/' }, undefined));
  expect(chain.stack.setParams).toHaveBeenCalledWith({ code: undefined });
  expect(chain.root.setParams).toHaveBeenCalledWith({ code: undefined });
  expect(chain.root.setParams.mock.invocationCallOrder[0]).toBeLessThan((Redirect as jest.Mock).mock.invocationCallOrder[0]);
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
