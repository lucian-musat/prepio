import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchProgress, markFinished, positionFromJson, savePosition, type LessonPosition } from './progress';

const L1 = '11111111-1111-4111-8111-111111111111';
const L2 = '22222222-2222-4222-8222-222222222222';
const L3 = '33333333-3333-4333-8333-333333333333';

/** Minimal chainable PostgREST stub: records calls, resolves with `result`. */
function fakeClient(result: { data: unknown; error: unknown }) {
  const calls: Array<[string, unknown[]]> = [];
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'upsert']) {
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

const POS: LessonPosition = { phase: 'questions', index: 2, results: { q1: true, q2: false } };

describe('positionFromJson', () => {
  it('rejects anything that is not a valid position', () => {
    expect(positionFromJson(null)).toBeNull();
    expect(positionFromJson('cards')).toBeNull();
    expect(positionFromJson({ phase: 'done', index: 0, results: {} })).toBeNull();
    expect(positionFromJson({ phase: 'cards', index: -1, results: {} })).toBeNull();
    expect(positionFromJson({ phase: 'cards', index: 1.5, results: {} })).toBeNull();
    expect(positionFromJson({ phase: 'cards', index: 0, results: 'x' })).toBeNull();
  });

  it('keeps a valid position', () => {
    expect(positionFromJson(POS)).toEqual(POS);
  });

  it('drops non-boolean results', () => {
    expect(positionFromJson({ phase: 'questions', index: 2, results: { q1: true, q2: 'x' } })).toEqual({
      phase: 'questions',
      index: 2,
      results: { q1: true },
    });
  });
});

describe('fetchProgress', () => {
  it('builds finished from rows with finished_at and positions from valid positions', async () => {
    const { client, from, calls } = fakeClient({
      data: [
        { lesson_id: L1, finished_at: '2026-11-04T10:00:00Z', position: null },
        { lesson_id: L2, finished_at: null, position: POS },
        { lesson_id: L3, finished_at: null, position: { phase: 'done' } },
      ],
      error: null,
    });
    const progress = await fetchProgress(client);
    expect(from).toHaveBeenCalledWith('lesson_progress');
    expect(calls).toContainEqual(['select', ['lesson_id,finished_at,position']]);
    expect([...progress.finished]).toEqual([L1]);
    expect([...progress.positions.entries()]).toEqual([[L2, POS]]);
  });

  it('throws on a query error', async () => {
    await expect(fetchProgress(fakeClient({ data: null, error: new Error('down') }).client)).rejects.toThrow('down');
  });
});

describe('savePosition', () => {
  it('upserts only lesson_id and position', async () => {
    const { client, from, calls } = fakeClient({ data: null, error: null });
    await savePosition(L1, POS, client);
    expect(from).toHaveBeenCalledWith('lesson_progress');
    expect(calls).toContainEqual(['upsert', [{ lesson_id: L1, position: POS }, { onConflict: 'user_id,lesson_id' }]]);
  });

  it('can clear the position with null', async () => {
    const { client, calls } = fakeClient({ data: null, error: null });
    await savePosition(L1, null, client);
    expect(calls).toContainEqual(['upsert', [{ lesson_id: L1, position: null }, { onConflict: 'user_id,lesson_id' }]]);
  });

  it('throws on a Supabase error', async () => {
    await expect(savePosition(L1, POS, fakeClient({ data: null, error: new Error('down') }).client)).rejects.toThrow('down');
  });
});

describe('markFinished', () => {
  it('upserts finished_at and clears the position', async () => {
    const { client, calls } = fakeClient({ data: null, error: null });
    await markFinished(L1, client);
    const [, args] = calls.find(([m]) => m === 'upsert')!;
    const [payload, options] = args as [Record<string, unknown>, unknown];
    expect(Object.keys(payload).sort()).toEqual(['finished_at', 'lesson_id', 'position']);
    expect(payload.lesson_id).toBe(L1);
    expect(payload.position).toBeNull();
    expect(new Date(payload.finished_at as string).toISOString()).toBe(payload.finished_at);
    expect(options).toEqual({ onConflict: 'user_id,lesson_id' });
  });

  it('throws the Romanian message on error', async () => {
    await expect(markFinished(L1, fakeClient({ data: null, error: new Error('down') }).client)).rejects.toThrow(
      'Progresul nu a putut fi salvat. Încearcă din nou.',
    );
  });
});
