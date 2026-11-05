// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import type { AnswerSpan } from '@prepio/shared';
import { extendLimit, segmentBody, selectionOffsets, snapToWords, spanFromSelection } from './selection';

const BODY = 'Alexandru Ioan Cuza a fost ales domn. Unirea a fost recunoscută în 1862.';

/** Renders the body as segments the way SpanMarker does: plain / highlighted spans, each with data-offset. */
function renderSegments(body: string, cuts: number[]): HTMLElement {
  const container = document.createElement('div');
  const points = [0, ...cuts, body.length];
  for (let i = 0; i < points.length - 1; i++) {
    const seg = document.createElement(i % 2 ? 'mark' : 'span');
    seg.dataset.offset = String(points[i]);
    seg.textContent = body.slice(points[i], points[i + 1]);
    container.appendChild(seg);
  }
  document.body.appendChild(container);
  return container;
}

function select(startNode: Node, startOffset: number, endNode: Node, endOffset: number): Selection {
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  const r = document.createRange();
  r.setStart(startNode, startOffset);
  r.setEnd(endNode, endOffset);
  sel.addRange(r);
  return sel;
}

afterEach(() => {
  document.body.innerHTML = '';
  window.getSelection()?.removeAllRanges();
});

describe('selectionOffsets', () => {
  it('maps a selection across two highlight spans to body offsets', () => {
    // segments: [0,10) [10,14) mark [14,26) [26,30) mark [30,...)
    const c = renderSegments(BODY, [10, 14, 26, 30]);
    const [, m1, , m2] = Array.from(c.children);
    const sel = select(m1!.firstChild!, 1, m2!.firstChild!, 3);
    expect(selectionOffsets(c, sel)).toEqual({ start: 11, end: 29 });
  });

  it('handles element boundary points and backwards order', () => {
    const c = renderSegments(BODY, [10, 14]);
    // end of the container (after the last child) ... start of the second segment
    const sel = select(c, 1, c, c.childNodes.length);
    expect(selectionOffsets(c, sel)).toEqual({ start: 10, end: BODY.length });
  });

  it('is null for no selection, a collapsed one, or one outside the container', () => {
    const c = renderSegments(BODY, [10, 14]);
    expect(selectionOffsets(c, null)).toBeNull();
    const t = c.firstChild!.firstChild!;
    expect(selectionOffsets(c, select(t, 2, t, 2))).toBeNull();
    const outside = document.createElement('p');
    outside.textContent = 'altceva';
    document.body.appendChild(outside);
    expect(selectionOffsets(c, select(outside.firstChild!, 0, outside.firstChild!, 3))).toBeNull();
  });
});

describe('snapToWords', () => {
  it('snaps partial words outwards to whole words', () => {
    // "xandru Ioan Cu" -> "Alexandru Ioan Cuza"
    expect(snapToWords(BODY, 3, 17)).toEqual({ start: 0, end: 19 });
  });

  it('gives null for a whitespace-only selection', () => {
    expect(snapToWords('unu   doi', 3, 6)).toBeNull();
    expect(snapToWords(BODY, 5, 5)).toBeNull();
  });
});

describe('spans', () => {
  it('spanFromSelection quotes the body and has no limit', () => {
    expect(spanFromSelection(BODY, 's1', { start: 0, end: 9 }, 'id1')).toEqual({
      id: 'id1', sourceId: 's1', start: 0, end: 9, text: 'Alexandru', limitStart: null, limitEnd: null,
    });
  });

  const body = 'Prima propoziție. A doua propoziție aici. A treia.';
  const core: AnswerSpan = { id: 'x', sourceId: 's', start: 18, end: 24, text: 'A doua', limitStart: null, limitEnd: null };

  it('extendLimit widens to the previous / next sentence and stops at the edges', () => {
    const prev = extendLimit(body, core, 'prev');
    expect(body.slice(prev.limitStart!, prev.limitEnd!)).toBe('Prima propoziție. A doua propoziție aici.');
    const both = extendLimit(body, prev, 'next');
    expect(body.slice(both.limitStart!, both.limitEnd!)).toBe(body);
    expect(extendLimit(body, both, 'next')).toEqual(both);
    expect(extendLimit(body, both, 'prev')).toEqual(both);
  });

  it('segmentBody cuts at every span and limit boundary', () => {
    const segs = segmentBody('unu doi trei', [{ id: 'a', sourceId: 's', start: 4, end: 7, text: 'doi', limitStart: null, limitEnd: null }]);
    expect(segs).toEqual([
      { start: 0, end: 4, spanIds: [] },
      { start: 4, end: 7, spanIds: ['a'] },
      { start: 7, end: 12, spanIds: [] },
    ]);
  });
});
