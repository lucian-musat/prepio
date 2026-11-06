import { act, render } from '@testing-library/react-native';
import { AppState, Text } from 'react-native';
import { CreditsProvider, useCredits } from './CreditsProvider';
import { fetchCreditBalance } from '../lib/credits';

let mockProfile: { id: string; creditBalance: number } | null;
jest.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ profile: mockProfile }) }));
jest.mock('../lib/credits', () => ({ fetchCreditBalance: jest.fn() }));
const mockFetch = fetchCreditBalance as jest.Mock;

let ctx: ReturnType<typeof useCredits>;
function Probe() {
  ctx = useCredits();
  return <Text>{String(ctx.balance)}</Text>;
}

let onChange: (s: string) => void;
const remove = jest.fn();

beforeEach(() => {
  mockProfile = { id: 'u1', creditBalance: 12 };
  mockFetch.mockReset().mockResolvedValue(12);
  remove.mockReset();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_t, cb) => {
    onChange = cb as (s: string) => void;
    return { remove } as never;
  });
});
afterEach(() => jest.restoreAllMocks());

const mount = async () =>
  await render(
    <CreditsProvider>
      <Probe />
    </CreditsProvider>,
  );

it('starts from the profile balance with no change', async () => {
  await mount();
  expect(ctx.balance).toBe(12);
  expect(ctx.change).toBeNull();
});

it('setBalance records the delta and bumps the id per change', async () => {
  await mount();
  await act(async () => ctx.setBalance(10));
  expect(ctx.balance).toBe(10);
  expect(ctx.change).toEqual({ delta: -2, id: 1 });
  await act(async () => ctx.setBalance(15));
  expect(ctx.change).toEqual({ delta: 5, id: 2 });
});

it('setBalance to the same value records no change', async () => {
  await mount();
  await act(async () => ctx.setBalance(12));
  expect(ctx.change).toBeNull();
});

it('refresh re-reads the balance and records the difference', async () => {
  await mount();
  mockFetch.mockResolvedValue(9);
  await act(async () => ctx.refresh());
  expect(mockFetch).toHaveBeenCalledWith('u1');
  expect(ctx.balance).toBe(9);
  expect(ctx.change?.delta).toBe(-3);
});

it('refresh failure keeps the balance', async () => {
  await mount();
  mockFetch.mockRejectedValue(new Error('down'));
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  await act(async () => ctx.refresh());
  expect(ctx.balance).toBe(12);
});

it('drops a refresh result that arrives after unmount', async () => {
  const view = await mount();
  let resolve: (n: number) => void = () => {};
  mockFetch.mockReturnValue(new Promise<number>((r) => (resolve = r)));
  const pending = ctx.refresh();
  const last = ctx;
  await view.unmount();
  await act(async () => {
    resolve(3);
    await pending;
  });
  expect(last.balance).toBe(12);
  expect(last.change).toBeNull();
});

it('drops a refresh result for a previous user', async () => {
  const view = await mount();
  let resolve: (n: number) => void = () => {};
  mockFetch.mockReturnValue(new Promise<number>((r) => (resolve = r)));
  const pending = ctx.refresh();
  mockProfile = { id: 'u2', creditBalance: 40 };
  await view.rerender(
    <CreditsProvider>
      <Probe />
    </CreditsProvider>,
  );
  await act(async () => {
    resolve(3);
    await pending;
  });
  expect(ctx.balance).toBe(40);
});

it('refreshes when the app becomes active and unsubscribes on unmount', async () => {
  const view = await mount();
  await act(async () => onChange('background'));
  expect(mockFetch).not.toHaveBeenCalled();
  await act(async () => onChange('active'));
  expect(mockFetch).toHaveBeenCalledTimes(1);
  await view.unmount();
  expect(remove).toHaveBeenCalled();
});
