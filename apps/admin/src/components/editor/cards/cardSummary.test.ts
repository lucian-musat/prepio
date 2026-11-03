import { describe, expect, it } from 'vitest';
import type { Card } from '@prepio/shared';
import { cardSummary } from './cardSummary';

const head = { id: 'c1', position: 0, title: null };
const box = (id: string, text = 'x') => ({ id, text, detail: null });
const point = (id: string) => ({ id, date: '1918', title: 'Unirea', details: null, key: false, imagePath: null });
const image = (path: string) => ({ path, alt: 'a', credit: null });

describe('cardSummary', () => {
  it.each<[string, Card, string]>([
    ['text: plain text without markup', { ...head, type: 'text', text: '### Titlu\n**Unirea** a avut *loc*.\n- unu' }, 'Titlu Unirea a avut loc. unu'],
    ['text: first 120 chars', { ...head, type: 'text', text: 'a'.repeat(200) }, 'a'.repeat(120)],
    ['images: plural', { ...head, type: 'images', images: [image('p1'), image('p2')], display: 'single', text: null }, '2 imagini'],
    ['images: singular', { ...head, type: 'images', images: [image('p1')], display: 'gallery', text: null }, '1 imagine'],
    ['video: id only', { ...head, type: 'video', youtubeId: 'dQw4w9WgXcQ', startSeconds: null, endSeconds: null, text: null }, 'YouTube · dQw4w9WgXcQ'],
    ['video: fragment', { ...head, type: 'video', youtubeId: 'dQw4w9WgXcQ', startSeconds: 10, endSeconds: 95, text: null }, 'YouTube · dQw4w9WgXcQ · 10s–95s'],
    ['timeline', { ...head, type: 'timeline', points: [point('a'), point('b'), point('c')] }, '3 puncte'],
    [
      'schema',
      {
        ...head, type: 'schema', causesLabel: 'Cauze', consequencesLabel: 'Urmări',
        causes: [box('a'), box('b')], central: box('c', 'Marea Unire'), consequences: [box('d'), box('e'), box('f')],
      },
      '2 cauze → Marea Unire → 3 urmări',
    ],
    ['link: hostname', { ...head, type: 'link', url: 'https://ro.wikipedia.org/wiki/Unirea', pageTitle: 'U', description: null, image: null, text: null }, 'ro.wikipedia.org'],
    ['link: invalid url falls back to the raw value', { ...head, type: 'link', url: 'nu e link', pageTitle: 'U', description: null, image: null, text: null }, 'nu e link'],
  ])('%s', (_name, card, expected) => {
    expect(cardSummary(card)).toBe(expected);
  });
});
