import { describe, expect, it } from 'vitest';
import { PREVIEW_READY_MESSAGE, isPreviewReadyMessage, parsePreviewMessage } from './previewProtocol';

const card = { id: 'c1', position: 2, title: 'Cauzele', type: 'text', text: 'Un paragraf.' };
const message = (over: Record<string, unknown> = {}) => ({ source: 'prepio-admin', kind: 'card', card, index: 1, total: 3, ...over });

describe('parsePreviewMessage', () => {
  it('returns the card, index and total of a well-formed admin message', () => {
    expect(parsePreviewMessage(message())).toEqual({
      card: { id: 'c1', position: 2, title: 'Cauzele', type: 'text', text: 'Un paragraf.' },
      index: 1,
      total: 3,
    });
  });

  it('coerces partial content through cardFromRow so renderers get every field', () => {
    const parsed = parsePreviewMessage(message({ card: { id: 'c2', position: 0, title: null, type: 'timeline', points: [{ date: 1918 }] } }));
    expect(parsed?.card).toEqual({
      id: 'c2',
      position: 0,
      title: null,
      type: 'timeline',
      points: [{ id: 'point-0', date: '', title: '', details: null, key: false, imagePath: null }],
    });
  });

  it('fills a missing id, position or title instead of rejecting an unsaved card', () => {
    const parsed = parsePreviewMessage(message({ card: { type: 'text', text: 'x', title: '' } }));
    expect(parsed?.card).toEqual({ id: 'preview', position: 0, title: null, type: 'text', text: 'x' });
  });

  it.each([
    ['null', null],
    ['a string', 'card'],
    ['an empty object', {}],
    ['a message without a card', { source: 'prepio-admin', kind: 'card' }],
    ['another source', message({ source: 'prepio-preview' })],
    ['another kind', message({ kind: 'ready' })],
    ['an unknown card type', message({ card: { ...card, type: 'nope' } })],
    ['a card that is not an object', message({ card: 'text' })],
    ['a non-integer index', message({ index: 1.5 })],
    ['a negative index', message({ index: -1 })],
    ['a string index', message({ index: '1' })],
    ['a total below 1', message({ index: 0, total: 0 })],
    ['a non-integer total', message({ total: 2.5 })],
    ['an index past the total', message({ index: 3, total: 3 })],
  ])('rejects %s', (_label, data) => {
    expect(parsePreviewMessage(data)).toBeNull();
  });
});

describe('isPreviewReadyMessage', () => {
  it('recognises the ready message and nothing else', () => {
    expect(isPreviewReadyMessage(PREVIEW_READY_MESSAGE)).toBe(true);
    expect(isPreviewReadyMessage({ source: 'prepio-preview', kind: 'ready' })).toBe(true);
    expect(isPreviewReadyMessage({ source: 'prepio-admin', kind: 'ready' })).toBe(false);
    expect(isPreviewReadyMessage({ source: 'prepio-preview' })).toBe(false);
    expect(isPreviewReadyMessage('ready')).toBe(false);
    expect(isPreviewReadyMessage(null)).toBe(false);
  });
});
