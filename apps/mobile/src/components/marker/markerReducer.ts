import type { Mark } from '@prepio/shared';

export type Pen = 'info' | 'cause' | 'effect' | 'support';
/** `slot` (0-based): the numbered slot the mark fills (numbered markers only). */
export type MarkerMark = Mark & { pen: Pen; slot?: number };
export type MarkerState = {
  /** The pen a new selection uses; null when no role is current (`idleWhenDone`, every pen marked). */
  pen: Pen | null;
  marks: MarkerMark[];
  /** First word of a tap-tap selection, waiting for the last one. */
  anchor: { sourceId: string; i: number } | null;
  /**
   * A selection being dragged: `a` stays fixed, `b` follows the finger or mouse. A handle drag keeps the mark it
   * lifted (and its index), so `cancel` can put it back.
   */
  drag: { sourceId: string; pen: Pen; a: number; b: number; lifted?: { index: number; mark: MarkerMark } } | null;
  /** Index in `marks` of the selected mark (it shows the handles). */
  active: number | null;
  /** Numbered markers: the slot a new selection fills; null when every slot is filled and none was chosen. */
  slot?: number | null;
};
/**
 * `limits` defaults to 1 per pen; `autoNext` switches the pen after a commit while the next pen has no mark;
 * `idleWhenDone`: once every pen has a mark no pen is current, and a new selection waits for `setPen`.
 * `numbered` (one pen, limit > 1): each mark fills a numbered slot; a selection fills the current slot (the first
 * empty one, or the one chosen with `setSlot` or by tapping its mark), and once every slot is filled a new
 * selection waits for a slot to be chosen.
 */
export type MarkerConfig = {
  pens: Pen[];
  limits: Partial<Record<Pen, number>>;
  autoNext?: Partial<Record<Pen, Pen>>;
  idleWhenDone?: boolean;
  numbered?: boolean;
};
export type MarkerAction =
  | { type: 'tap'; sourceId: string; i: number } // tap on word i
  | { type: 'dragStart'; sourceId: string; i: number } // after long-press (touch) or immediately (mouse)
  | { type: 'dragMove'; i: number }
  | { type: 'dragEnd' }
  | { type: 'handleStart'; end: 'start' | 'end' } // drag a handle of the active mark
  | { type: 'setPen'; pen: Pen }
  | { type: 'setSlot'; slot: number } // numbered: the slot the next selection fills
  | { type: 'remove'; index: number }
  | { type: 'swapRoles' }
  | { type: 'cancel' }; // drop the anchor, the selection and an unfinished drag; a lifted mark goes back (e.g. the reader closes)

export function initialMarker(cfg: MarkerConfig, marks: MarkerMark[] = []): MarkerState {
  if (cfg.numbered) {
    // Saved answers carry no slots: they fill slots 1..n in their saved order.
    const slotted = marks.map((m, k) => ({ ...m, slot: m.slot ?? marks.slice(0, k).filter((x) => x.pen === m.pen).length }));
    return { ...at(cfg, firstEmpty(cfg, slotted)), marks: slotted, anchor: null, drag: null, active: null };
  }
  return { pen: done(cfg, marks) ? null : cfg.pens[0] ?? 'info', marks, anchor: null, drag: null, active: null };
}

const covers = (m: MarkerMark, sourceId: string, i: number) => m.sourceId === sourceId && i >= m.from && i <= m.to;
/** With `idleWhenDone`: every pen has a mark, so no pen stays current. */
const done = (cfg: MarkerConfig, marks: MarkerMark[]) => !!cfg.idleWhenDone && cfg.pens.every((p) => marks.some((m) => m.pen === p));

/** Numbered: the first slot without a mark, or null when every slot is filled. */
function firstEmpty(cfg: MarkerConfig, marks: MarkerMark[]): number | null {
  const n = Math.max(1, cfg.limits[cfg.pens[0]!] ?? 1);
  for (let k = 0; k < n; k++) if (!marks.some((m) => m.slot === k)) return k;
  return null;
}
/** Numbered: slot k is current (its pen with it), or nothing is (idle). */
const at = (cfg: MarkerConfig, slot: number | null) => ({ slot, pen: slot === null ? null : cfg.pens[0] ?? null });

/**
 * Numbered: the mark [min(a,b), max(a,b)] fills `slot` (overlapping marks and the slot's old mark go), then the
 * first empty slot becomes current.
 */
function commitSlot(cfg: MarkerConfig, s: MarkerState, pen: Pen, slot: number, sourceId: string, a: number, b: number): MarkerState {
  const from = Math.min(a, b);
  const to = Math.max(a, b);
  const marks = s.marks.filter((m) => m.slot !== slot && (m.sourceId !== sourceId || m.to < from || m.from > to));
  marks.push({ sourceId, from, to, pen, slot });
  return { ...s, ...at(cfg, firstEmpty(cfg, marks)), marks, anchor: null, drag: null, active: marks.length - 1 };
}

/** Adds the mark [min(a,b), max(a,b)]: overlapping marks go, then the pen's oldest marks while it is at its limit. */
function commit(cfg: MarkerConfig, s: MarkerState, pen: Pen, sourceId: string, a: number, b: number, slot?: number): MarkerState {
  if (cfg.numbered) {
    const target = slot ?? s.slot;
    return target === null || target === undefined ? { ...s, anchor: null, drag: null } : commitSlot(cfg, s, pen, target, sourceId, a, b);
  }
  const from = Math.min(a, b);
  const to = Math.max(a, b);
  const marks = s.marks.filter((m) => m.sourceId !== sourceId || m.to < from || m.from > to);
  const limit = Math.max(1, cfg.limits[pen] ?? 1);
  while (marks.filter((m) => m.pen === pen).length >= limit) marks.splice(marks.findIndex((m) => m.pen === pen), 1);
  marks.push({ sourceId, from, to, pen });
  const next = cfg.autoNext?.[pen];
  const switchPen = next !== undefined && !marks.some((m) => m.pen === next);
  return { ...s, marks, anchor: null, drag: null, active: marks.length - 1, pen: done(cfg, marks) ? null : switchPen ? next : s.pen };
}

export function markerReducer(cfg: MarkerConfig): (s: MarkerState, a: MarkerAction) => MarkerState {
  return (s, a) => {
    switch (a.type) {
      case 'tap': {
        if (s.drag) return s;
        const hit = s.marks.findIndex((m) => covers(m, a.sourceId, a.i));
        if (hit >= 0 && !s.anchor) {
          const slot = s.marks[hit]!.slot;
          // Numbered: tapping a mark also makes its slot the one a new selection replaces.
          return { ...s, active: s.active === hit ? null : hit, ...(cfg.numbered && slot !== undefined ? at(cfg, slot) : {}) };
        }
        if (s.pen === null) return s;
        if (!s.anchor || s.anchor.sourceId !== a.sourceId) return { ...s, anchor: { sourceId: a.sourceId, i: a.i }, active: null };
        return commit(cfg, s, s.pen, a.sourceId, s.anchor.i, a.i);
      }
      case 'dragStart':
        if (s.pen === null) return s;
        return { ...s, drag: { sourceId: a.sourceId, pen: s.pen, a: a.i, b: a.i }, anchor: null, active: null };
      case 'dragMove':
        if (!s.drag || s.drag.b === a.i) return s;
        return { ...s, drag: { ...s.drag, b: a.i } };
      case 'dragEnd':
        if (!s.drag) return s;
        return commit(cfg, s, s.drag.pen, s.drag.sourceId, s.drag.a, s.drag.b, s.drag.lifted?.mark.slot);
      case 'handleStart': {
        const m = s.active === null || s.drag ? undefined : s.marks[s.active];
        if (!m) return s;
        const [fixed, moving] = a.end === 'start' ? [m.to, m.from] : [m.from, m.to];
        return {
          ...s,
          marks: s.marks.filter((_, k) => k !== s.active),
          drag: { sourceId: m.sourceId, pen: m.pen, a: fixed, b: moving, lifted: { index: s.active!, mark: m } },
          anchor: null,
          active: null,
        };
      }
      case 'setPen':
        // Numbered and idle: the pen alone does not pick a slot.
        if (cfg.numbered && (s.slot === null || s.slot === undefined)) return { ...s, anchor: null };
        return { ...s, pen: a.pen, anchor: null };
      case 'setSlot':
        return cfg.numbered ? { ...s, ...at(cfg, a.slot), anchor: null } : s;
      case 'remove': {
        const gone = s.marks[a.index];
        if (!gone) return s;
        const active = s.active === null || s.active === a.index ? null : s.active > a.index ? s.active - 1 : s.active;
        // The removed mark's role (numbered: its slot) becomes current: its gap is the one to fill again.
        const slot = cfg.numbered && gone.slot !== undefined ? { slot: gone.slot } : {};
        return { ...s, marks: s.marks.filter((_, k) => k !== a.index), active, pen: gone.pen, ...slot };
      }
      case 'swapRoles': {
        const swap = (p: Pen): Pen => (p === 'cause' ? 'effect' : p === 'effect' ? 'cause' : p);
        return { ...s, marks: s.marks.map((m) => ({ ...m, pen: swap(m.pen) })) };
      }
      case 'cancel': {
        // A handle drag that never finished puts its mark back, unchanged; a new selection is just dropped.
        const lifted = s.drag?.lifted;
        const marks = lifted ? [...s.marks.slice(0, lifted.index), lifted.mark, ...s.marks.slice(lifted.index)] : s.marks;
        return { ...s, marks, anchor: null, active: null, drag: null };
      }
    }
  };
}
