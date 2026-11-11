import { initialMarker, markerReducer, type MarkerAction, type MarkerConfig, type MarkerState } from './markerReducer';

const A = 'src-a';
const B = 'src-b';
const info: MarkerConfig = { pens: ['info'], limits: { info: 1 } };
const ce: MarkerConfig = {
  pens: ['cause', 'effect'],
  limits: { cause: 1, effect: 1 },
  autoNext: { cause: 'effect', effect: 'cause' },
  idleWhenDone: true,
};
const support: MarkerConfig = { pens: ['support'], limits: { support: 2 } };

const run = (cfg: MarkerConfig, actions: MarkerAction[], from: MarkerState = initialMarker(cfg)) =>
  actions.reduce(markerReducer(cfg), from);
const tap = (i: number, sourceId = A): MarkerAction => ({ type: 'tap', sourceId, i });

describe('initialMarker', () => {
  it('starts on the first pen with no selection', () => {
    expect(initialMarker(ce)).toEqual({ pen: 'cause', marks: [], anchor: null, drag: null, active: null });
  });

  it('keeps the given marks', () => {
    const marks = [{ sourceId: A, from: 1, to: 2, pen: 'info' as const }];
    expect(initialMarker(info, marks).marks).toEqual(marks);
  });
});

describe('tap-tap', () => {
  it('the first tap sets the anchor, the second commits the range as the active mark', () => {
    const one = run(info, [tap(2)]);
    expect(one.anchor).toEqual({ sourceId: A, i: 2 });
    expect(one.marks).toEqual([]);
    const two = run(info, [tap(5)], one);
    expect(two.anchor).toBeNull();
    expect(two.marks).toEqual([{ sourceId: A, from: 2, to: 5, pen: 'info' }]);
    expect(two.active).toBe(0);
  });

  it('commits in reversed order as {from: min, to: max}', () => {
    expect(run(info, [tap(7), tap(3)]).marks).toEqual([{ sourceId: A, from: 3, to: 7, pen: 'info' }]);
  });

  it('the same word twice makes a one-word mark', () => {
    expect(run(info, [tap(4), tap(4)]).marks).toEqual([{ sourceId: A, from: 4, to: 4, pen: 'info' }]);
  });

  it('a tap on another source moves the anchor there', () => {
    const s = run(info, [tap(2, A), tap(5, B)]);
    expect(s.anchor).toEqual({ sourceId: B, i: 5 });
    expect(s.marks).toEqual([]);
  });

  it('a tap on a mark without an anchor toggles it as active', () => {
    const s = run(info, [tap(2), tap(5)]);
    const off = run(info, [tap(3)], s);
    expect(off.active).toBeNull();
    expect(off.anchor).toBeNull();
    expect(run(info, [tap(4)], off).active).toBe(0);
  });

  it('a tap on a mark while anchored commits instead of toggling', () => {
    const s = run(support, [tap(2), tap(5), tap(0), tap(3)]);
    expect(s.marks).toEqual([{ sourceId: A, from: 0, to: 3, pen: 'support' }]);
  });

  it('a tap outside a mark sets the anchor and drops the active mark', () => {
    const s = run(info, [tap(2), tap(5), tap(9)]);
    expect(s.active).toBeNull();
    expect(s.anchor).toEqual({ sourceId: A, i: 9 });
  });

  it('ignores taps while dragging', () => {
    const s = run(info, [{ type: 'dragStart', sourceId: A, i: 1 }]);
    expect(run(info, [tap(4)], s)).toBe(s);
  });
});

describe('committing', () => {
  it('a mark overlapping an existing one replaces it', () => {
    // [6, 8] touches [8, 9] (replaced) but not [2, 5] (kept).
    const s = run(support, [tap(2), tap(5), tap(8), tap(9), tap(6), tap(8)]);
    expect(s.marks).toEqual([
      { sourceId: A, from: 2, to: 5, pen: 'support' },
      { sourceId: A, from: 6, to: 8, pen: 'support' },
    ]);
    expect(s.active).toBe(1);
    // A mark covering both replaces both.
    expect(run(support, [tap(0), tap(9)], s).marks).toEqual([{ sourceId: A, from: 0, to: 9, pen: 'support' }]);
  });

  it('overlap is per source', () => {
    const s = run(support, [tap(2, A), tap(5, A), tap(2, B), tap(5, B)]);
    expect(s.marks).toHaveLength(2);
  });

  it('at the pen limit the oldest mark of that pen is replaced', () => {
    const s = run(support, [tap(0), tap(1), tap(4), tap(5), tap(8), tap(9)]);
    expect(s.marks).toEqual([
      { sourceId: A, from: 4, to: 5, pen: 'support' },
      { sourceId: A, from: 8, to: 9, pen: 'support' },
    ]);
    expect(s.active).toBe(1);
  });

  it('a limit of 1 keeps one mark per pen, other pens stay', () => {
    const s = run(ce, [tap(0), tap(1), tap(4), tap(5), { type: 'setPen', pen: 'cause' }, tap(8), tap(9)]);
    expect(s.marks).toEqual([
      { sourceId: A, from: 4, to: 5, pen: 'effect' },
      { sourceId: A, from: 8, to: 9, pen: 'cause' },
    ]);
  });

  it('autoNext switches from cause to effect when no effect exists', () => {
    const s = run(ce, [tap(0), tap(1)]);
    expect(s.pen).toBe('effect');
  });

  it('autoNext does not switch when an effect already exists', () => {
    const oneWay: MarkerConfig = { pens: ['cause', 'effect'], limits: { cause: 1, effect: 1 }, autoNext: { cause: 'effect' } };
    const s = run(oneWay, [{ type: 'setPen', pen: 'effect' }, tap(4), tap(5), { type: 'setPen', pen: 'cause' }, tap(0), tap(1)]);
    expect(s.pen).toBe('cause');
  });

  it('without autoNext the pen stays', () => {
    expect(run(info, [tap(0), tap(1)]).pen).toBe('info');
  });
});

describe('drag', () => {
  it('dragStart, dragMove and dragEnd commit the dragged range with the pen at the start', () => {
    const started = run(ce, [tap(9), { type: 'dragStart', sourceId: A, i: 3 }]);
    expect(started.anchor).toBeNull();
    expect(started.drag).toEqual({ sourceId: A, pen: 'cause', a: 3, b: 3 });
    const moved = run(ce, [{ type: 'dragMove', i: 1 }], started);
    expect(moved.drag).toEqual({ sourceId: A, pen: 'cause', a: 3, b: 1 });
    const ended = run(ce, [{ type: 'dragEnd' }], moved);
    expect(ended.drag).toBeNull();
    expect(ended.marks).toEqual([{ sourceId: A, from: 1, to: 3, pen: 'cause' }]);
    expect(ended.active).toBe(0);
    expect(ended.pen).toBe('effect');
  });

  it('a dragMove to the same word returns the same state', () => {
    const s = run(info, [{ type: 'dragStart', sourceId: A, i: 3 }]);
    expect(run(info, [{ type: 'dragMove', i: 3 }], s)).toBe(s);
  });

  it('dragMove and dragEnd without a drag are no-ops', () => {
    const s = run(info, [tap(2), tap(5)]);
    expect(run(info, [{ type: 'dragMove', i: 8 }], s)).toBe(s);
    expect(run(info, [{ type: 'dragEnd' }], s)).toBe(s);
  });
});

describe('handles', () => {
  it('dragging the end handle adjusts the end, the start stays fixed', () => {
    const s = run(support, [tap(8), tap(9), tap(2), tap(5)]);
    const lifted = run(support, [{ type: 'handleStart', end: 'end' }], s);
    expect(lifted.marks).toEqual([{ sourceId: A, from: 8, to: 9, pen: 'support' }]);
    expect(lifted.drag).toMatchObject({ sourceId: A, pen: 'support', a: 2, b: 5 });
    expect(lifted.active).toBeNull();
    const done = run(support, [{ type: 'dragMove', i: 6 }, { type: 'dragEnd' }], lifted);
    expect(done.marks).toEqual([
      { sourceId: A, from: 8, to: 9, pen: 'support' },
      { sourceId: A, from: 2, to: 6, pen: 'support' },
    ]);
    expect(done.active).toBe(1);
  });

  it('dragging the start handle adjusts the start', () => {
    const s = run(info, [tap(2), tap(5), { type: 'handleStart', end: 'start' }]);
    expect(s.drag).toMatchObject({ sourceId: A, pen: 'info', a: 5, b: 2 });
    expect(run(info, [{ type: 'dragMove', i: 4 }, { type: 'dragEnd' }], s).marks).toEqual([{ sourceId: A, from: 4, to: 5, pen: 'info' }]);
  });

  it('the handle keeps the mark pen even when another pen is selected', () => {
    const s = run(ce, [tap(0), tap(1)]); // pen switched to effect
    const lifted = run(ce, [{ type: 'handleStart', end: 'end' }, { type: 'dragMove', i: 3 }, { type: 'dragEnd' }], s);
    expect(lifted.marks).toEqual([{ sourceId: A, from: 0, to: 3, pen: 'cause' }]);
  });

  it('handleStart without an active mark is a no-op', () => {
    const s = run(info, [tap(2)]);
    expect(run(info, [{ type: 'handleStart', end: 'end' }], s)).toBe(s);
  });
});

describe('other actions', () => {
  it('setPen selects the pen and clears the anchor', () => {
    const s = run(ce, [tap(2), { type: 'setPen', pen: 'effect' }]);
    expect(s.pen).toBe('effect');
    expect(s.anchor).toBeNull();
  });

  it('remove deletes a mark and keeps the active one pointing at the same mark', () => {
    const s = run(support, [tap(0), tap(1), tap(4), tap(5)]);
    expect(s.active).toBe(1);
    const r = run(support, [{ type: 'remove', index: 0 }], s);
    expect(r.marks).toEqual([{ sourceId: A, from: 4, to: 5, pen: 'support' }]);
    expect(r.active).toBe(0);
    expect(run(support, [{ type: 'remove', index: 0 }], r)).toMatchObject({ marks: [], active: null });
  });

  it('swapRoles swaps the cause and effect pens', () => {
    const s = run(ce, [tap(0), tap(1), tap(4), tap(5), { type: 'swapRoles' }]);
    expect(s.marks).toEqual([
      { sourceId: A, from: 0, to: 1, pen: 'effect' },
      { sourceId: A, from: 4, to: 5, pen: 'cause' },
    ]);
  });

  it('cancel clears the anchor, the active mark and an unfinished drag', () => {
    const s = run(info, [tap(2), tap(5), tap(8)]);
    expect(run(info, [{ type: 'cancel' }], s)).toMatchObject({ anchor: null, active: null, drag: null, marks: s.marks });
    const d = run(info, [{ type: 'dragStart', sourceId: A, i: 1 }, { type: 'cancel' }]);
    expect(d).toMatchObject({ drag: null, marks: [] });
  });

  it('cancel during a handle drag puts the lifted mark back where it was, unchanged', () => {
    const s = run(support, [tap(0), tap(1), tap(4), tap(5), tap(0)]); // the first mark is active
    expect(s.active).toBe(0);
    const lifted = run(support, [{ type: 'handleStart', end: 'end' }, { type: 'dragMove', i: 3 }], s);
    expect(lifted.marks).toHaveLength(1);
    const c = run(support, [{ type: 'cancel' }], lifted);
    expect(c.marks).toEqual(s.marks);
    expect(c).toMatchObject({ drag: null, anchor: null, active: null });
  });
});

describe('cause-effect roles', () => {
  const both = () => run(ce, [tap(0), tap(1), tap(5), tap(6)]);
  const drag = (a: number, b: number): MarkerAction[] => [
    { type: 'dragStart', sourceId: A, i: a },
    { type: 'dragMove', i: b },
    { type: 'dragEnd' },
  ];

  it('effect first, then auto-switches to cause', () => {
    const s = run(ce, [{ type: 'setPen', pen: 'effect' }, tap(0), tap(3)]);
    expect(s.pen).toBe('cause');
    expect(s.marks).toEqual([{ sourceId: A, from: 0, to: 3, pen: 'effect' }]);
  });

  it('idle once both are marked', () => {
    expect(both().pen).toBeNull();
  });

  it('idle: a new drag or a tap outside the marks is ignored', () => {
    const s = both();
    const dragged = run(ce, drag(9, 10), s);
    expect(dragged.marks).toEqual(s.marks);
    expect(dragged.drag).toBeNull();
    expect(run(ce, [tap(9)], s).anchor).toBeNull();
  });

  it('idle: tapping a mark still selects it for handles', () => {
    const s = run(ce, [{ type: 'cancel' }], both());
    expect(run(ce, [tap(0)], s).active).toBe(0);
  });

  it('setPen from idle, then the next selection replaces that role', () => {
    const s = run(ce, [{ type: 'setPen', pen: 'cause' }, tap(9), tap(10)], both());
    expect(s.marks).toEqual([
      { sourceId: A, from: 5, to: 6, pen: 'effect' },
      { sourceId: A, from: 9, to: 10, pen: 'cause' },
    ]);
    expect(s.pen).toBeNull();
  });

  it('remove makes that role current', () => {
    const s = both();
    const cause = s.marks.findIndex((m) => m.pen === 'cause');
    expect(run(ce, [{ type: 'remove', index: cause }], s).pen).toBe('cause');
  });

  it('overlap: marking over the other role deletes it and switches to it', () => {
    const s = run(ce, [tap(0), tap(3), ...drag(2, 5)]);
    expect(s.marks).toEqual([{ sourceId: A, from: 2, to: 5, pen: 'effect' }]);
    expect(s.pen).toBe('cause');
  });

  it('swapRoles while idle stays idle', () => {
    const s = run(ce, [{ type: 'swapRoles' }], both());
    expect(s.pen).toBeNull();
    expect(s.marks.map((m) => m.pen)).toEqual(['effect', 'cause']);
  });

  it('a handle drag while idle stays idle', () => {
    const s = run(ce, [{ type: 'cancel' }, tap(0), { type: 'handleStart', end: 'end' }, { type: 'dragMove', i: 2 }, { type: 'dragEnd' }], both());
    expect(s.marks).toContainEqual({ sourceId: A, from: 0, to: 2, pen: 'cause' });
    expect(s.pen).toBeNull();
  });

  it('initialMarker restores idle when both roles are marked', () => {
    const cause = { sourceId: A, from: 0, to: 1, pen: 'cause' as const };
    const effect = { sourceId: A, from: 5, to: 6, pen: 'effect' as const };
    expect(initialMarker(ce, [cause, effect]).pen).toBeNull();
    expect(initialMarker(ce, [cause]).pen).toBe('cause');
  });
});

describe('numbered', () => {
  const num: MarkerConfig = { pens: ['info'], limits: { info: 2 }, numbered: true };
  const m = (from: number, to: number, slot: number) => ({ sourceId: A, from, to, pen: 'info' as const, slot });

  it('fills slot 1, then slot 2, then goes idle', () => {
    expect(initialMarker(num)).toMatchObject({ pen: 'info', slot: 0 });
    const one = run(num, [tap(0), tap(1)]);
    expect(one.marks).toEqual([m(0, 1, 0)]);
    expect(one).toMatchObject({ pen: 'info', slot: 1 });
    const two = run(num, [tap(4), tap(5)], one);
    expect(two.marks).toEqual([m(0, 1, 0), m(4, 5, 1)]);
    expect(two).toMatchObject({ pen: null, slot: null });
  });

  it('ignores a new selection once every slot is filled', () => {
    const full = run(num, [tap(0), tap(1), tap(4), tap(5)]);
    const after = run(num, [tap(8), tap(9)], full);
    expect(after.marks).toEqual(full.marks);
    expect(after.anchor).toBeNull();
  });

  it('setSlot picks the slot a selection replaces, then goes idle again', () => {
    const full = run(num, [tap(0), tap(1), tap(4), tap(5)]);
    const s = run(num, [{ type: 'setSlot', slot: 0 }, tap(8), tap(9)], full);
    expect(s.marks).toEqual([m(4, 5, 1), m(8, 9, 0)]);
    expect(s).toMatchObject({ pen: null, slot: null });
  });

  it('setPen while idle stays idle', () => {
    const full = run(num, [tap(0), tap(1), tap(4), tap(5)]);
    expect(run(num, [{ type: 'setPen', pen: 'info' }], full)).toMatchObject({ pen: null, slot: null });
  });

  it('remove keeps the other slot and its number; the emptied slot becomes current', () => {
    const full = run(num, [tap(0), tap(1), tap(4), tap(5)]);
    const r = run(num, [{ type: 'remove', index: 0 }], full);
    expect(r.marks).toEqual([m(4, 5, 1)]);
    expect(r).toMatchObject({ pen: 'info', slot: 0 });
  });

  it('a selection overlapping another slot removes that mark and fills the current slot', () => {
    const one = run(num, [tap(0), tap(3)]);
    // A tap inside a mark selects it, so the overlapping selection is a drag.
    const s = run(num, [{ type: 'dragStart', sourceId: A, i: 5 }, { type: 'dragMove', i: 2 }, { type: 'dragEnd' }], one);
    expect(s.marks).toEqual([m(2, 5, 1)]);
    expect(s).toMatchObject({ pen: 'info', slot: 0 });
  });

  it('tapping a mark makes its slot current', () => {
    const full = run(num, [tap(0), tap(1), tap(4), tap(5)]);
    const s = run(num, [tap(0)], full); // the second mark was active; the first one becomes active
    expect(s).toMatchObject({ pen: 'info', slot: 0, active: 0 });
  });

  it('a handle drag keeps the slot; cancel puts the mark back with its slot', () => {
    const full = run(num, [tap(0), tap(1), tap(4), tap(5)]); // the second mark is active
    const lifted = run(num, [{ type: 'handleStart', end: 'end' }, { type: 'dragMove', i: 7 }], full);
    expect(run(num, [{ type: 'dragEnd' }], lifted).marks).toEqual([m(0, 1, 0), m(4, 7, 1)]);
    expect(run(num, [{ type: 'cancel' }], lifted).marks).toEqual([m(0, 1, 0), m(4, 5, 1)]);
  });

  it('a drag commits into the current slot', () => {
    const s = run(num, [{ type: 'setSlot', slot: 1 }, { type: 'dragStart', sourceId: A, i: 2 }, { type: 'dragMove', i: 4 }, { type: 'dragEnd' }]);
    expect(s.marks).toEqual([m(2, 4, 1)]);
    expect(s).toMatchObject({ pen: 'info', slot: 0 });
  });

  it('initialMarker assigns slots in order: idle when full, the first empty slot otherwise', () => {
    const plain = [
      { sourceId: A, from: 0, to: 1, pen: 'info' as const },
      { sourceId: A, from: 4, to: 5, pen: 'info' as const },
    ];
    const full = initialMarker(num, plain);
    expect(full.marks).toEqual([m(0, 1, 0), m(4, 5, 1)]);
    expect(full).toMatchObject({ pen: null, slot: null });
    expect(initialMarker(num, plain.slice(0, 1))).toMatchObject({ pen: 'info', slot: 1 });
  });
});
