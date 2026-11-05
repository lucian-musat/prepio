import type { Mark } from '@prepio/shared';

export type Pen = 'info' | 'cause' | 'effect' | 'support';
export type MarkerMark = Mark & { pen: Pen };
export type MarkerState = {
  pen: Pen;
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
};
/** `limits` defaults to 1 per pen; `autoNext` switches the pen after a commit while the next pen has no mark. */
export type MarkerConfig = { pens: Pen[]; limits: Partial<Record<Pen, number>>; autoNext?: Partial<Record<Pen, Pen>> };
export type MarkerAction =
  | { type: 'tap'; sourceId: string; i: number } // tap on word i
  | { type: 'dragStart'; sourceId: string; i: number } // after long-press (touch) or immediately (mouse)
  | { type: 'dragMove'; i: number }
  | { type: 'dragEnd' }
  | { type: 'handleStart'; end: 'start' | 'end' } // drag a handle of the active mark
  | { type: 'setPen'; pen: Pen }
  | { type: 'remove'; index: number }
  | { type: 'swapRoles' }
  | { type: 'cancel' }; // drop the anchor, the selection and an unfinished drag; a lifted mark goes back (e.g. the reader closes)

export function initialMarker(cfg: MarkerConfig, marks: MarkerMark[] = []): MarkerState {
  return { pen: cfg.pens[0] ?? 'info', marks, anchor: null, drag: null, active: null };
}

const covers = (m: MarkerMark, sourceId: string, i: number) => m.sourceId === sourceId && i >= m.from && i <= m.to;

/** Adds the mark [min(a,b), max(a,b)]: overlapping marks go, then the pen's oldest marks while it is at its limit. */
function commit(cfg: MarkerConfig, s: MarkerState, pen: Pen, sourceId: string, a: number, b: number): MarkerState {
  const from = Math.min(a, b);
  const to = Math.max(a, b);
  const marks = s.marks.filter((m) => m.sourceId !== sourceId || m.to < from || m.from > to);
  const limit = Math.max(1, cfg.limits[pen] ?? 1);
  while (marks.filter((m) => m.pen === pen).length >= limit) marks.splice(marks.findIndex((m) => m.pen === pen), 1);
  marks.push({ sourceId, from, to, pen });
  const next = cfg.autoNext?.[pen];
  const switchPen = next !== undefined && !marks.some((m) => m.pen === next);
  return { ...s, marks, anchor: null, drag: null, active: marks.length - 1, pen: switchPen ? next : s.pen };
}

export function markerReducer(cfg: MarkerConfig): (s: MarkerState, a: MarkerAction) => MarkerState {
  return (s, a) => {
    switch (a.type) {
      case 'tap': {
        if (s.drag) return s;
        const hit = s.marks.findIndex((m) => covers(m, a.sourceId, a.i));
        if (hit >= 0 && !s.anchor) return { ...s, active: s.active === hit ? null : hit };
        if (!s.anchor || s.anchor.sourceId !== a.sourceId) return { ...s, anchor: { sourceId: a.sourceId, i: a.i }, active: null };
        return commit(cfg, s, s.pen, a.sourceId, s.anchor.i, a.i);
      }
      case 'dragStart':
        return { ...s, drag: { sourceId: a.sourceId, pen: s.pen, a: a.i, b: a.i }, anchor: null, active: null };
      case 'dragMove':
        if (!s.drag || s.drag.b === a.i) return s;
        return { ...s, drag: { ...s.drag, b: a.i } };
      case 'dragEnd':
        if (!s.drag) return s;
        return commit(cfg, s, s.drag.pen, s.drag.sourceId, s.drag.a, s.drag.b);
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
        return { ...s, pen: a.pen, anchor: null };
      case 'remove': {
        if (!s.marks[a.index]) return s;
        const active = s.active === null || s.active === a.index ? null : s.active > a.index ? s.active - 1 : s.active;
        return { ...s, marks: s.marks.filter((_, k) => k !== a.index), active };
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
