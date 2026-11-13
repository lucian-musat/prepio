import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc, createAdminClient, listUiTexts, saveUiText, resetUiText } = vi.hoisted(() => ({
  rpc: vi.fn(),
  createAdminClient: vi.fn(() => ({ service: true })),
  listUiTexts: vi.fn(async () => []),
  saveUiText: vi.fn(async () => undefined),
  resetUiText: vi.fn(async () => undefined),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/sentry', () => ({ captureError: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createServerClient: async () => ({ rpc }) }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => createAdminClient() }));
vi.mock('@/lib/data/uiTexts', () => ({ listUiTexts, saveUiText, resetUiText }));

import { resetUiTextAction, saveUiTextAction } from './actions';

beforeEach(() => vi.clearAllMocks());

describe('texts actions admin proof', () => {
  it.each([
    ['not an admin', { data: false, error: null }],
    ['rpc error', { data: null, error: { message: 'boom' } }],
  ])('refuses and never builds the service client (%s)', async (_n, res) => {
    rpc.mockResolvedValue(res);
    for (const r of [await saveUiTextAction('home.hero.welcome', 'x'), await resetUiTextAction('home.hero.welcome')]) {
      expect(r).toEqual({ ok: false, error: 'Nu ai drepturi de administrator.' });
    }
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(saveUiText).not.toHaveBeenCalled();
    expect(resetUiText).not.toHaveBeenCalled();
  });

  it('proceeds for an admin and uses the service client for the listing', async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    const r = await saveUiTextAction('home.hero.welcome', 'x');
    expect(r.ok).toBe(true);
    expect(saveUiText).toHaveBeenCalled();
    expect(createAdminClient).toHaveBeenCalledTimes(1);
  });
});
