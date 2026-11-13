import { fetchStreak, markActiveToday } from './streak';

const mockRpc = jest.fn();
jest.mock('./supabase', () => ({
  ...jest.requireActual('./supabase'),
  getSupabase: () => ({ rpc: mockRpc }),
}));

const reply = { current: 3, record: 4, today_done: true, week: ['2026-11-13'] };

beforeEach(() => {
  mockRpc.mockReset();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('parses the RPC reply', async () => {
  mockRpc.mockResolvedValue({ data: reply, error: null });
  expect(await fetchStreak()).toEqual({ current: 3, record: 4, todayDone: true, week: ['2026-11-13'] });
  expect(mockRpc).toHaveBeenCalledWith('my_streak');
  await markActiveToday();
  expect(mockRpc).toHaveBeenCalledWith('mark_active_today');
});

it('resolves null on an RPC error', async () => {
  mockRpc.mockResolvedValue({ data: null, error: new Error('boom') });
  expect(await fetchStreak()).toBeNull();
});

it('resolves null when the RPC hangs for 10 seconds', async () => {
  jest.useFakeTimers();
  mockRpc.mockReturnValue(new Promise(() => {}));
  const p = markActiveToday();
  await jest.advanceTimersByTimeAsync(10_000);
  expect(await p).toBeNull();
});
