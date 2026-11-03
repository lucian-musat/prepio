import { describe, expect, it } from 'vitest';
import {
  CARD_TYPES,
  cardFromRow,
  cardImagePaths,
  cardToRow,
  emptyCardContent,
  parseYouTubeId,
  validateCard,
} from './cards';
import type { CardContent, CardType } from './types';

type Of<T extends CardType> = Extract<CardContent, { type: T }>;

describe('parseYouTubeId', () => {
  it.each([
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s',
    'https://youtu.be/dQw4w9WgXcQ?si=x',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    'dQw4w9WgXcQ',
    '  https://youtu.be/dQw4w9WgXcQ  ',
  ])('extracts the id from %s', (input) => {
    expect(parseYouTubeId(input)).toBe('dQw4w9WgXcQ');
  });

  it.each([
    'https://www.youtube.com/playlist?list=PL123',
    'https://vimeo.com/123',
    'https://evil.com/watch?v=dQw4w9WgXcQ',
    '',
    'dQw4w9WgXc',
  ])('rejects %s', (input) => {
    expect(parseYouTubeId(input)).toBeNull();
  });
});

const counter = () => {
  let n = 0;
  return () => `id${n++}`;
};

const samples: { [K in CardType]: Of<K> } = {
  text: { type: 'text', text: 'Salut' },
  images: {
    type: 'images',
    images: [{ path: 'a.jpg', alt: 'A', credit: 'C' }],
    display: 'gallery',
    text: 'Legenda',
  },
  video: { type: 'video', youtubeId: 'dQw4w9WgXcQ', startSeconds: 5, endSeconds: 10, text: null },
  timeline: {
    type: 'timeline',
    points: [
      { id: 'p1', date: '1821', title: 'A', details: 'd', key: true, imagePath: 'p.jpg' },
      { id: 'p2', date: '1859', title: 'B', details: null, key: false, imagePath: null },
    ],
  },
  schema: {
    type: 'schema',
    causesLabel: 'Cauze',
    consequencesLabel: 'Urmări',
    causes: [{ id: 'c1', text: 'Cauza', detail: null }],
    central: { id: 'central', text: 'Eveniment', detail: 'x' },
    consequences: [{ id: 'u1', text: 'Urmarea', detail: null }],
  },
  link: {
    type: 'link',
    url: 'https://example.com',
    pageTitle: 'Ex',
    description: null,
    image: { kind: 'path', path: 'l.jpg' },
    text: null,
  },
};

describe('card rows', () => {
  it.each(CARD_TYPES)('round-trips a %s card', (type) => {
    const title = 'T';
    const row = cardToRow({ ...samples[type], title });
    expect(row.type).toBe(type);
    expect(row.title).toBe(title);
    expect(row.content).not.toHaveProperty('type');
    expect(row.content).not.toHaveProperty('title');
    expect(cardFromRow({ id: 'c', position: 3, ...row })).toEqual({
      id: 'c',
      position: 3,
      ...samples[type],
      title,
    });
  });

  it.each(CARD_TYPES)('fills defaults for empty %s content', (type) => {
    const card = cardFromRow({ id: 'c', position: 0, title: null, type, content: {} });
    const empty = emptyCardContent(type, counter());
    // Same shape as the empty content, ids aside (cardFromRow has no id generator).
    expect(Object.keys(card).sort()).toEqual(
      [...new Set(['id', 'position', 'title', ...Object.keys(empty)])].sort(),
    );
    expect(JSON.stringify(card)).not.toContain('undefined');
    if (card.type === 'schema') {
      expect(card.causesLabel).toBe('Cauze');
      expect(card.consequencesLabel).toBe('Urmări');
      expect(card.causes).toEqual([]);
      expect(card.consequences).toEqual([]);
      expect(card.central.id).toBe('central');
    }
    if (card.type === 'timeline') expect(card.points).toEqual([]);
    if (card.type === 'images') expect(card.images).toEqual([]);
  });

  it('assigns deterministic ids to items missing them and coerces bad fields', () => {
    const card = cardFromRow({
      id: 'c',
      position: 0,
      title: null,
      type: 'schema',
      content: { causes: [{ text: 'a' }, { id: 5, text: 7 }], central: {}, consequences: 'nope' },
    });
    if (card.type !== 'schema') throw new Error('wrong type');
    expect(card.causes.map((b) => b.id)).toEqual(['cause-0', 'cause-1']);
    expect(card.causes[1]!.text).toBe('');
    expect(card.central.id).toBe('central');
    expect(card.consequences).toEqual([]);
  });

  it('coerces wrong-typed scalars to defaults', () => {
    const card = cardFromRow({
      id: 'c',
      position: 0,
      title: null,
      type: 'video',
      content: { youtubeId: 4, startSeconds: 'x', endSeconds: -3, text: 9 },
    });
    expect(card).toMatchObject({ youtubeId: '', startSeconds: null, endSeconds: -3, text: null });
  });

  it('gives unique ids to missing ids across causes and consequences', () => {
    const row = {
      id: 'c',
      position: 0,
      title: null,
      type: 'schema' as const,
      content: { causes: [{ text: 'a' }, { text: 'b' }], central: { text: 'x' }, consequences: [{ text: 'c' }, { text: 'd' }] },
    };
    const card = cardFromRow(row);
    if (card.type !== 'schema') throw new Error('wrong type');
    expect(card.consequences.map((b) => b.id)).toEqual(['consequence-0', 'consequence-1']);
    expect(card.central.id).toBe('central');
    expect(validateCard(card)).toEqual([]);
  });

  it('de-duplicates stored duplicate ids so cardFromRow output passes uniqueness', () => {
    const schema = cardFromRow({
      id: 'c',
      position: 0,
      title: null,
      type: 'schema',
      content: {
        causes: [{ id: 'a', text: 'a' }, { id: 'a', text: 'b' }, { id: 'central', text: 'c' }],
        central: { id: 'x', text: 'x' },
        consequences: [{ id: 'a', text: 'd' }, { id: 'cause-1', text: 'e' }],
      },
    });
    if (schema.type !== 'schema') throw new Error('wrong type');
    const all = [...schema.causes, schema.central, ...schema.consequences].map((b) => b.id);
    expect(new Set(all).size).toBe(all.length);
    expect(validateCard(schema)).not.toContain('Elementele trebuie să aibă identificatori unici.');

    const timeline = cardFromRow({
      id: 'c',
      position: 0,
      title: null,
      type: 'timeline',
      content: { points: [{ id: 'p', date: '1', title: 'A' }, { id: 'p', date: '2', title: 'B' }, { date: '3', title: 'C' }] },
    });
    if (timeline.type !== 'timeline') throw new Error('wrong type');
    expect(timeline.points.map((p) => p.id)).toEqual(['p', 'point-1', 'point-2']);
    expect(validateCard(timeline)).toEqual([]);
  });

  it('uses newId for fresh ids', () => {
    const c = emptyCardContent('schema', counter());
    if (c.type !== 'schema') throw new Error('wrong type');
    expect(c.central.id).toBe('id0');
  });
});

describe('cardImagePaths', () => {
  it('collects storage paths per type', () => {
    expect(cardImagePaths(samples.images)).toEqual(['a.jpg']);
    expect(cardImagePaths(samples.timeline)).toEqual(['p.jpg']);
    expect(cardImagePaths(samples.link)).toEqual(['l.jpg']);
    expect(
      cardImagePaths({ ...samples.link, image: { kind: 'url', url: 'https://x.y/i.png' } }),
    ).toEqual([]);
    expect(cardImagePaths(samples.text)).toEqual([]);
    expect(cardImagePaths(samples.video)).toEqual([]);
    expect(cardImagePaths(samples.schema)).toEqual([]);
  });
});

describe('validateCard', () => {
  it.each(CARD_TYPES)('accepts a valid %s card', (type) => {
    expect(validateCard(samples[type])).toEqual([]);
  });

  it('validates text', () => {
    expect(validateCard({ ...samples.text, text: '  ' })).toContain('Textul nu poate fi gol.');
  });

  it('validates images', () => {
    expect(validateCard({ ...samples.images, images: [] })).toContain('Adaugă cel puțin o imagine.');
    const two = [
      { path: 'a', alt: 'A', credit: null },
      { path: 'b', alt: ' ', credit: null },
    ];
    expect(validateCard({ ...samples.images, images: two })).toContain(
      'Imaginea 2: descrierea nu poate fi goală.',
    );
  });

  it('validates video', () => {
    expect(validateCard({ ...samples.video, youtubeId: '' })).toContain('Linkul YouTube nu este valid.');
    expect(validateCard({ ...samples.video, startSeconds: -1 })).toContain('Secundele nu pot fi negative.');
    expect(validateCard({ ...samples.video, startSeconds: 30, endSeconds: 30 })).toContain(
      'Secunda de final trebuie să fie după cea de start.',
    );
  });

  it('validates timeline', () => {
    const [p1, p2] = samples.timeline.points as [Of<'timeline'>['points'][0], Of<'timeline'>['points'][0]];
    const msg = (points: typeof samples.timeline.points) => validateCard({ type: 'timeline', points });
    expect(msg([p1])).toContain('Axa cronologică are nevoie de cel puțin 2 puncte.');
    expect(msg([p1, { ...p2, date: '' }])).toContain('Punctul 2: data nu poate fi goală.');
    expect(msg([{ ...p1, title: '' }, p2])).toContain('Punctul 1: titlul nu poate fi gol.');
    expect(msg([p1, { ...p2, id: p1.id }])).toContain('Elementele trebuie să aibă identificatori unici.');
  });

  it('validates schema', () => {
    const s = samples.schema;
    expect(validateCard({ ...s, causes: [] })).toContain('Schema are nevoie de cel puțin o cauză.');
    expect(validateCard({ ...s, consequences: [] })).toContain('Schema are nevoie de cel puțin o urmare.');
    expect(validateCard({ ...s, central: { ...s.central, text: '' } })).toContain(
      'Evenimentul central nu poate fi gol.',
    );
    expect(validateCard({ ...s, causes: [{ id: 'c1', text: ' ', detail: null }] })).toContain(
      'Căsuțele schemei nu pot fi goale.',
    );
    expect(validateCard({ ...s, causes: [s.causes[0]!, s.causes[0]!] })).toContain(
      'Elementele trebuie să aibă identificatori unici.',
    );
  });

  it('validates link', () => {
    for (const url of ['ftp://x', 'javascript:alert(1)']) {
      expect(validateCard({ ...samples.link, url })).toContain(
        'Linkul trebuie să înceapă cu http:// sau https://.',
      );
    }
    expect(validateCard({ ...samples.link, pageTitle: ' ' })).toContain('Titlul linkului nu poate fi gol.');
  });
});
