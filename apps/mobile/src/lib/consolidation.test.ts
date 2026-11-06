import type { SupabaseClient } from '@supabase/supabase-js';
import {
  countConsolidation,
  fetchAttempts,
  fetchConsolidation,
  fetchRun,
  moveRun,
  newRun,
  resolveRun,
  runAt,
  saveAttempt,
  saveRun,
  type Attempt,
} from './consolidation';

const attempt = (exerciseId: string, verdict: Attempt['verdict']): Attempt => ({
  exerciseId,
  answer: { type: 'comparison', text: 'x' },
  verdict,
  feedback: { verdict, items: [] },
});
const attemptsOf = (...a: Attempt[]) => new Map(a.map((x) => [x.exerciseId, x]));

describe('resolveRun', () => {
  const valid = ['a', 'b', 'c'];

  it('no run and no attempts starts a new run over all', () => {
    expect(resolveRun(valid, null, new Map())).toEqual({ kind: 'new', run: { exerciseIds: valid, index: 0, finished: false } });
  });

  it('no run and some attempts still starts a new full run', () => {
    const r = resolveRun(valid, null, attemptsOf(attempt('a', 'ok')));
    expect(r).toEqual({ kind: 'new', run: { exerciseIds: valid, index: 0, finished: false } });
  });

  it('no run and every exercise attempted opens the end screen', () => {
    const all = attemptsOf(attempt('a', 'ok'), attempt('b', 'no'), attempt('c', null));
    expect(resolveRun(valid, null, all)).toEqual({ kind: 'end' });
  });

  it('an unfinished run resumes at its index', () => {
    const run = { exerciseIds: ['a', 'b', 'c'], index: 1, finished: false };
    expect(resolveRun(valid, run, new Map())).toEqual({ kind: 'resume', run });
  });

  it('drops unknown ids from an unfinished run, keeping the position and clamping the index', () => {
    const run = { exerciseIds: ['gone', 'a', 'b', 'c'], index: 2, finished: false };
    expect(resolveRun(valid, run, new Map())).toEqual({
      kind: 'resume',
      run: { exerciseIds: ['a', 'b', 'c'], index: 1, finished: false },
    });
    const tail = { exerciseIds: ['a', 'b', 'gone'], index: 2, finished: false };
    expect(resolveRun(valid, tail, new Map())).toEqual({
      kind: 'resume',
      run: { exerciseIds: ['a', 'b'], index: 1, finished: false },
    });
  });

  it('a run whose ids are all gone opens the end screen when attempts exist, otherwise starts anew', () => {
    const run = { exerciseIds: ['x', 'y'], index: 0, finished: false };
    expect(resolveRun(valid, run, attemptsOf(attempt('a', 'ok')))).toEqual({ kind: 'end' });
    expect(resolveRun(valid, run, new Map())).toEqual({ kind: 'new', run: { exerciseIds: valid, index: 0, finished: false } });
  });

  it('a finished run opens the end screen', () => {
    expect(resolveRun(valid, { exerciseIds: ['a'], index: 0, finished: true }, new Map())).toEqual({ kind: 'end' });
  });
});

describe('newRun', () => {
  const valid = ['a', 'b', 'c'];
  it('covers every exercise by default', () => {
    expect(newRun(valid, attemptsOf(attempt('a', 'ok')), false)).toEqual({ exerciseIds: valid, index: 0, finished: false });
  });
  it('with onlyNotCorrect keeps exercises whose latest verdict is not ok (including unattempted)', () => {
    const attempts = attemptsOf(attempt('a', 'ok'), attempt('b', 'almost'));
    expect(newRun(valid, attempts, true)).toEqual({ exerciseIds: ['b', 'c'], index: 0, finished: false });
  });
});

describe('moveRun', () => {
  const run = { exerciseIds: ['a', 'b', 'c'], index: 1, finished: false };
  it('goes to any exercise of the run, forwards or back', () => {
    expect(moveRun(run, 2)).toEqual({ ...run, index: 2 });
    expect(moveRun(run, 0)).toEqual({ ...run, index: 0 });
  });
  it('past the last exercise the run is finished (the end screen), keeping its index', () => {
    expect(moveRun({ ...run, index: 2 }, 3)).toEqual({ ...run, index: 2, finished: true });
  });
  it('never goes before the first exercise', () => {
    expect(moveRun({ ...run, index: 0 }, -1)).toEqual({ ...run, index: 0 });
  });
});

describe('runAt', () => {
  it('is a full run positioned at the exercise', () => {
    expect(runAt(['a', 'b', 'c'], 'c')).toEqual({ exerciseIds: ['a', 'b', 'c'], index: 2, finished: false });
  });
  it('an unknown exercise starts at the first', () => {
    expect(runAt(['a', 'b'], 'x')).toEqual({ exerciseIds: ['a', 'b'], index: 0, finished: false });
  });
});

type Result = { data: unknown; error: unknown };
function mockClient(results: Record<string, Result>) {
  const log: Array<{ table: string; method: string; args: unknown[] }> = [];
  const from = (table: string) => {
    const result = results[table] ?? { data: null, error: null };
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'order', 'upsert', 'maybeSingle']) {
      chain[m] = (...args: unknown[]) => {
        log.push({ table, method: m, args });
        return m === 'maybeSingle' ? Promise.resolve(result) : chain;
      };
    }
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(result).then(res, rej);
    return chain;
  };
  return { client: { from } as unknown as SupabaseClient, log };
}

const exRow = (id: string, position: number, extra: Record<string, unknown> = {}, sources: unknown[] = []) => ({
  id,
  position,
  type: 'comparison',
  prompt: `p-${id}`,
  content: { variant: 'similarity' },
  template_id: null,
  consolidation_exercise_sources: sources,
  ...extra,
});

describe('fetchConsolidation', () => {
  it('keeps position order and drops an exercise with a detached span, warning about it', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const body = 'Domnitorul a condus țara.';
    const good = exRow(
      'e1',
      2,
      { type: 'source_info', content: { count: 1, spans: [{ id: 'sp', sourceId: 's1', start: 0, end: 10, text: 'Domnitorul' }] }, template_id: 't1' },
      [{ source_id: 's1', label: 'A', position: 0 }],
    );
    const bad = exRow(
      'e2',
      1,
      { type: 'source_info', content: { count: 1, spans: [{ id: 'sp', sourceId: 's1', start: 0, end: 10, text: 'ALT TEXT!!' }] } },
      [{ source_id: 's1', label: 'A', position: 0 }],
    );
    const plain = exRow('e3', 3);
    const { client, log } = mockClient({
      consolidation_exercises: { error: null, data: [plain, good, bad] },
      sources: { error: null, data: [{ id: 's1', position: 0, title: null, author: 'X', work: 'Y', body }] },
      solution_templates: { error: null, data: [{ id: 't1', title: 'T', exercise_type: null, points: '', body: 'b' }] },
    });
    const data = await fetchConsolidation('l1', client);
    expect(data.lessonId).toBe('l1');
    expect(data.exercises.map((e) => e.id)).toEqual(['e1', 'e3']);
    expect([...data.sources.keys()]).toEqual(['s1']);
    expect([...data.templates.keys()]).toEqual(['t1']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('e2'));
    expect(log.find((c) => c.table === 'consolidation_exercises' && c.method === 'eq')?.args).toEqual(['lesson_id', 'l1']);
    warn.mockRestore();
  });

  it('returns nothing for a lesson without exercises, without querying sources or templates', async () => {
    const { client, log } = mockClient({ consolidation_exercises: { error: null, data: [] } });
    const data = await fetchConsolidation('l1', client);
    expect(data.exercises).toEqual([]);
    expect(log.some((c) => c.table === 'sources')).toBe(false);
  });

  it('throws on a query error', async () => {
    const { client } = mockClient({ consolidation_exercises: { error: new Error('boom'), data: null } });
    await expect(fetchConsolidation('l1', client)).rejects.toThrow('boom');
  });

  it('countConsolidation counts the valid exercises', async () => {
    const { client } = mockClient({ consolidation_exercises: { error: null, data: [exRow('e1', 1), exRow('e2', 2)] } });
    expect(await countConsolidation('l1', client)).toBe(2);
  });
});

describe('attempts', () => {
  it('fetchAttempts maps rows by exercise id; empty ids query nothing', async () => {
    const fb = { verdict: 'ok', items: [] };
    const { client, log } = mockClient({
      consolidation_attempts: {
        error: null,
        data: [{ exercise_id: 'e1', answer: { type: 'comparison', text: 'x' }, verdict: 'ok', feedback: fb }],
      },
    });
    const map = await fetchAttempts(['e1'], client);
    expect(map.get('e1')).toEqual({ exerciseId: 'e1', answer: { type: 'comparison', text: 'x' }, verdict: 'ok', feedback: fb });
    expect(log.find((c) => c.method === 'in')?.args).toEqual(['exercise_id', ['e1']]);
    const none = mockClient({});
    expect((await fetchAttempts([], none.client)).size).toBe(0);
    expect(none.log).toEqual([]);
  });

  it('saveAttempt upserts on (user_id, exercise_id)', async () => {
    const { client, log } = mockClient({});
    const a = attempt('e1', 'no');
    await saveAttempt(a, client);
    const up = log.find((c) => c.method === 'upsert')!;
    expect(up.args).toEqual([
      { exercise_id: 'e1', answer: a.answer, verdict: 'no', feedback: a.feedback },
      { onConflict: 'user_id,exercise_id' },
    ]);
  });

  it('saveAttempt throws on error', async () => {
    const { client } = mockClient({ consolidation_attempts: { data: null, error: new Error('rls') } });
    await expect(saveAttempt(attempt('e1', 'ok'), client)).rejects.toThrow('rls');
  });
});

describe('runs', () => {
  it('fetchRun maps the row; null when absent', async () => {
    const row = { exercise_ids: ['a', 'b'], index: 1, finished_at: null };
    expect(await fetchRun('l1', mockClient({ consolidation_runs: { error: null, data: row } }).client)).toEqual({
      exerciseIds: ['a', 'b'],
      index: 1,
      finished: false,
    });
    const done = mockClient({ consolidation_runs: { error: null, data: { ...row, finished_at: '2026-01-01T00:00:00Z' } } });
    expect(await fetchRun('l1', done.client)).toMatchObject({ finished: true });
    expect(await fetchRun('l1', mockClient({ consolidation_runs: { error: null, data: null } }).client)).toBeNull();
  });

  it('saveRun upserts on (user_id, lesson_id), finished <-> finished_at', async () => {
    const m = mockClient({});
    await saveRun('l1', { exerciseIds: ['a'], index: 0, finished: false }, m.client);
    expect(m.log.find((c) => c.method === 'upsert')!.args).toEqual([
      { lesson_id: 'l1', exercise_ids: ['a'], index: 0, finished_at: null },
      { onConflict: 'user_id,lesson_id' },
    ]);
    const m2 = mockClient({});
    await saveRun('l1', { exerciseIds: ['a'], index: 0, finished: true }, m2.client);
    const payload = m2.log.find((c) => c.method === 'upsert')!.args[0] as { finished_at: string };
    expect(typeof payload.finished_at).toBe('string');
  });
});
