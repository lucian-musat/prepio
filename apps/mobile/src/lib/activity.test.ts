import { logAppOpen, logTestFailed } from './activity';
import { getSupabase } from './supabase';

jest.mock('./supabase', () => ({ getSupabase: jest.fn() }));

const rpc = jest.fn();

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ data: null, error: null });
  (getSupabase as jest.Mock).mockReturnValue({ rpc });
});

afterEach(() => jest.restoreAllMocks());

describe('logAppOpen', () => {
  it('calls log_app_open and resolves true', async () => {
    await expect(logAppOpen()).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith('log_app_open');
  });

  it('swallows an RPC error (resolves false)', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'not_authenticated' } });
    await expect(logAppOpen()).resolves.toBe(false);
  });

  it('swallows a thrown network error', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    rpc.mockRejectedValue(new TypeError('Network request failed'));
    await expect(logAppOpen()).resolves.toBe(false);
  });
});

describe('logTestFailed', () => {
  it('calls log_test_failed with the lesson id', async () => {
    await expect(logTestFailed('l1')).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith('log_test_failed', { p_lesson: 'l1' });
  });

  it('swallows errors', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'bad_lesson' } });
    await expect(logTestFailed('l1')).resolves.toBe(false);
    rpc.mockRejectedValue(new Error('boom'));
    await expect(logTestFailed('l1')).resolves.toBe(false);
  });
});
