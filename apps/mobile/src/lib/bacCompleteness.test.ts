import type { BacItem } from '@prepio/shared';
import { answeredCount } from './bac';

const item = (id: string, over: Record<string, unknown>) => ({ id, number: id, points: 2, ...over }) as unknown as BacItem;
const mark = (n: number) => ({ start: n, end: n, slot: n });

const viewpoint = item('v', { type: 'viewpoint', count: 2 });
const facts = item('f', { type: 'facts', count: 2 });
const info = item('i', { type: 'source_info', count: 2 });
const cause = item('c', { type: 'cause_effect' });
const essay = item('e', { type: 'essay', requirements: [{ id: 'r1' }, { id: 'r2' }] });
const short = item('s', { type: 'short_answer' });

describe('answeredCount: complete, partial, empty', () => {
  it('a viewpoint needs its text and every mark', () => {
    const r = answeredCount([viewpoint], { v: { type: 'viewpoint', text: '', marks: [mark(1), mark(2)] } } as never);
    expect(r).toMatchObject({ answered: 0, total: 1 });
    expect(r.partial.map((i) => i.id)).toEqual(['v']);
    expect(r.empty).toEqual([]);
    const full = answeredCount([viewpoint], { v: { type: 'viewpoint', text: 'Consider că…', marks: [mark(1), mark(2)] } } as never);
    expect(full).toMatchObject({ answered: 1, partial: [], empty: [] });
  });

  it('facts, marks and cause-effect are partial until every part is there', () => {
    const r = answeredCount([facts, info, cause], {
      f: { type: 'facts', texts: ['unu', ''] },
      i: { type: 'source_info', marks: [mark(1)] },
      c: { type: 'cause_effect', cause: mark(1), effect: null },
    } as never);
    expect(r.answered).toBe(0);
    expect(r.partial.map((i) => i.id)).toEqual(['f', 'i', 'c']);
  });

  it('an essay with some requirements written is partial', () => {
    const r = answeredCount([essay], { e: { type: 'essay', parts: { r1: 'text' } } } as never);
    expect(r.partial.map((i) => i.id)).toEqual(['e']);
  });

  it('nothing written is empty, not partial', () => {
    const r = answeredCount([short, viewpoint], {} as never);
    expect(r).toMatchObject({ answered: 0, total: 2, partial: [] });
    expect(r.empty.map((i) => i.id)).toEqual(['s', 'v']);
  });
});
