import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchProfile, updateDisplayName, validateDisplayName } from './profile';

const USER = '11111111-1111-4111-8111-111111111111';

/** Minimal chainable PostgREST stub: records calls, resolves with `result`. */
function fakeClient(result: { data: unknown; error: unknown }) {
  const calls: Array<[string, unknown[]]> = [];
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'update', 'maybeSingle']) {
    builder[m] = (...args: unknown[]) => {
      calls.push([m, args]);
      return builder;
    };
  }
  builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  const from = jest.fn(() => builder);
  return { client: { from } as unknown as SupabaseClient, from, calls };
}

describe('validateDisplayName', () => {
  it('trims the name', () => {
    expect(validateDisplayName('  Ana  ')).toEqual({ ok: true, value: 'Ana' });
  });

  it('rejects an empty or whitespace-only name', () => {
    expect(validateDisplayName('')).toEqual({ ok: false, message: 'Scrie-ți numele.' });
    expect(validateDisplayName('   ')).toEqual({ ok: false, message: 'Scrie-ți numele.' });
  });

  it('accepts 60 characters and rejects 61 (after trimming)', () => {
    expect(validateDisplayName(` ${'a'.repeat(60)} `)).toEqual({ ok: true, value: 'a'.repeat(60) });
    expect(validateDisplayName('a'.repeat(61))).toEqual({
      ok: false,
      message: 'Numele poate avea cel mult 60 de caractere.',
    });
  });

  it('counts characters, not UTF-16 units (diacritics and emoji count once)', () => {
    expect(validateDisplayName('ș'.repeat(60))).toEqual({ ok: true, value: 'ș'.repeat(60) });
    expect(validateDisplayName('😀'.repeat(60))).toEqual({ ok: true, value: '😀'.repeat(60) });
  });
});

describe('fetchProfile', () => {
  it('reads the own profile row and maps display_name', async () => {
    const { client, from, calls } = fakeClient({ data: { id: USER, display_name: 'Ana' }, error: null });
    await expect(fetchProfile(USER, client)).resolves.toEqual({ id: USER, displayName: 'Ana' });
    expect(from).toHaveBeenCalledWith('profiles');
    expect(calls).toContainEqual(['select', ['id,display_name']]);
    expect(calls).toContainEqual(['eq', ['id', USER]]);
  });

  it('returns null when there is no row and keeps a null name', async () => {
    await expect(fetchProfile(USER, fakeClient({ data: null, error: null }).client)).resolves.toBeNull();
    await expect(
      fetchProfile(USER, fakeClient({ data: { id: USER, display_name: null }, error: null }).client),
    ).resolves.toEqual({ id: USER, displayName: null });
  });

  it('throws on a query error', async () => {
    const { client } = fakeClient({ data: null, error: new Error('down') });
    await expect(fetchProfile(USER, client)).rejects.toThrow('down');
  });
});

describe('updateDisplayName', () => {
  it('saves the trimmed name on the own row', async () => {
    const { client, from, calls } = fakeClient({ data: [{ id: USER }], error: null });
    await updateDisplayName(USER, '  Ana  ', client);
    expect(from).toHaveBeenCalledWith('profiles');
    expect(calls).toContainEqual(['update', [{ display_name: 'Ana' }]]);
    expect(calls).toContainEqual(['eq', ['id', USER]]);
  });

  it('refuses an invalid name without calling the database', async () => {
    const { client, from } = fakeClient({ data: [], error: null });
    await expect(updateDisplayName(USER, '   ', client)).rejects.toThrow('Scrie-ți numele.');
    expect(from).not.toHaveBeenCalled();
  });

  it('throws when the update fails or touches no row', async () => {
    await expect(
      updateDisplayName(USER, 'Ana', fakeClient({ data: null, error: new Error('down') }).client),
    ).rejects.toThrow('down');
    await expect(updateDisplayName(USER, 'Ana', fakeClient({ data: [], error: null }).client)).rejects.toThrow(
      'Numele nu a putut fi salvat. Încearcă din nou.',
    );
  });
});
