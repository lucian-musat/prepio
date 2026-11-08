import { act, render } from '@testing-library/react-native';
import { AppState, Text } from 'react-native';
import { AccessProvider, useAccess } from './AccessProvider';
import { fetchAccessOffer, fetchAccessUntil, fetchFreeLessonId } from '../lib/access';
import { refreshRegisteredAccess } from '../lib/profileRefresh';

let mockProfile: { id: string; accessUntil: string | null } | null;
jest.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ profile: mockProfile }) }));
jest.mock('../lib/access', () => ({ fetchAccessOffer: jest.fn(), fetchAccessUntil: jest.fn(), fetchFreeLessonId: jest.fn() }));
const mockOffer = fetchAccessOffer as jest.Mock;
const mockUntil = fetchAccessUntil as jest.Mock;
const mockFree = fetchFreeLessonId as jest.Mock;

const OFFER = { priceBani: 15000, bonusCredits: 100, durationMonths: 3 };
const DAY = 24 * 3600 * 1000;
const inDays = (n: number) => new Date(Date.now() + n * DAY).toISOString();

let ctx: ReturnType<typeof useAccess>;
function Probe() {
  ctx = useAccess();
  return <Text>{ctx.status.plan}</Text>;
}
let onChange: (s: string) => void;

beforeEach(() => {
  mockProfile = { id: 'u1', accessUntil: null };
  mockOffer.mockReset().mockResolvedValue(OFFER);
  mockUntil.mockReset().mockResolvedValue(null);
  mockFree.mockReset().mockResolvedValue('L1');
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_t, cb) => {
    onChange = cb as (s: string) => void;
    return { remove: jest.fn() } as never;
  });
});
afterEach(() => jest.restoreAllMocks());

const tree = (
  <AccessProvider>
    <Probe />
  </AccessProvider>
);
const mount = async () => await render(tree);

it('loads the offer and the free lesson; trial status without access_until', async () => {
  await mount();
  expect(ctx.status).toEqual({ plan: 'trial' });
  expect(ctx.offer).toEqual(OFFER);
  expect(ctx.freeLessonId).toBe('L1');
});

it('trial opens only the free lesson', async () => {
  await mount();
  expect(ctx.canOpen('L1')).toBe(true);
  expect(ctx.canOpen('L2')).toBe(false);
});

it('full access opens every lesson', async () => {
  mockProfile = { id: 'u1', accessUntil: inDays(60) };
  mockUntil.mockResolvedValue(mockProfile.accessUntil);
  await mount();
  expect(ctx.status.plan).toBe('full');
  expect(ctx.canOpen('L2')).toBe(true);
});

it('expired behaves like trial', async () => {
  mockProfile = { id: 'u1', accessUntil: inDays(-2) };
  mockUntil.mockResolvedValue(mockProfile.accessUntil);
  await mount();
  expect(ctx.status.plan).toBe('expired');
  expect(ctx.canOpen('L2')).toBe(false);
  expect(ctx.canOpen('L1')).toBe(true);
});

it('an empty Home gives a null free lesson and opens nothing without crashing', async () => {
  mockFree.mockResolvedValue(null);
  await mount();
  expect(ctx.freeLessonId).toBeNull();
  expect(ctx.canOpen('L1')).toBe(false);
});

it('the free lesson follows a reorder on refresh', async () => {
  await mount();
  mockFree.mockResolvedValue('L2');
  await act(async () => ctx.refresh());
  expect(ctx.freeLessonId).toBe('L2');
  expect(ctx.canOpen('L1')).toBe(false);
  expect(ctx.canOpen('L2')).toBe(true);
});

it('refresh re-reads access_until and the offer', async () => {
  await mount();
  mockUntil.mockResolvedValue(inDays(30));
  mockOffer.mockResolvedValue({ ...OFFER, priceBani: 20000 });
  await act(async () => ctx.refresh());
  expect(ctx.status.plan).toBe('full');
  expect(ctx.offer?.priceBani).toBe(20000);
});

it('a failed refresh keeps the previous state and does not throw', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockProfile = { id: 'u1', accessUntil: inDays(30) };
  mockUntil.mockResolvedValue(mockProfile.accessUntil);
  await mount();
  mockUntil.mockRejectedValue(new Error('offline'));
  mockFree.mockRejectedValue(new Error('offline'));
  await act(async () => ctx.refresh());
  expect(ctx.status.plan).toBe('full');
  expect(ctx.freeLessonId).toBe('L1');
});

it('applyPurchase unlocks immediately', async () => {
  await mount();
  await act(async () => ctx.applyPurchase({ orderId: 'o', accessUntil: inDays(90), bonus: 100, balance: 105 }));
  expect(ctx.status.plan).toBe('full');
  expect(ctx.canOpen('L2')).toBe(true);
});

it('refreshes when the app returns to the foreground', async () => {
  await mount();
  mockUntil.mockResolvedValue(inDays(30));
  await act(async () => onChange('active'));
  expect(ctx.status.plan).toBe('full');
});

it('can be refreshed from profileRefresh (403 access_required)', async () => {
  await mount();
  mockUntil.mockResolvedValue(inDays(-1));
  await act(async () => refreshRegisteredAccess());
  expect(mockUntil).toHaveBeenCalledTimes(2);
  expect(ctx.status.plan).toBe('expired');
});

it('a profile reload with a new access_until replaces the local value', async () => {
  const r = await mount();
  mockProfile = { id: 'u1', accessUntil: inDays(60) };
  await r.rerender(
    <AccessProvider>
      <Probe />
    </AccessProvider>,
  );
  expect(ctx.status.plan).toBe('full');
});
