import type {
  Card,
  CardContent,
  CardImage,
  CardRow,
  CardType,
  DistributiveOmit,
  LinkImage,
  SchemaBox,
  TimelinePoint,
} from './types';

export const CARD_TYPES: readonly CardType[] = ['text', 'images', 'video', 'timeline', 'schema', 'link'];

export const CARD_TYPE_LABELS: Record<CardType, string> = {
  text: 'Text',
  images: 'Imagini',
  video: 'Video',
  timeline: 'Axă cronologică',
  schema: 'Schemă',
  link: 'Link',
};

export function emptyCardContent(type: CardType, newId: () => string): CardContent {
  switch (type) {
    case 'text':
      return { type, text: '' };
    case 'images':
      return { type, images: [], display: 'single', text: null };
    case 'video':
      return { type, youtubeId: '', startSeconds: null, endSeconds: null, text: null };
    case 'timeline':
      return { type, points: [] };
    case 'schema':
      return {
        type,
        causesLabel: 'Cauze',
        consequencesLabel: 'Urmări',
        causes: [],
        central: { id: newId(), text: '', detail: null },
        consequences: [],
      };
    case 'link':
      return { type, url: '', title: '', description: null, image: null, text: null };
  }
}

// --- Coercion helpers: row content is untrusted JSON, wrong types fall back to defaults. ---

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const arr = (v: unknown): Json[] => (Array.isArray(v) ? v.map((x) => (isObj(x) ? x : {})) : []);
const id = (v: unknown, fallback: string) => (typeof v === 'string' && v !== '' ? v : fallback);

const box = (v: unknown, fallbackId: string): SchemaBox => {
  const o = isObj(v) ? v : {};
  return { id: id(o.id, fallbackId), text: str(o.text), detail: strOrNull(o.detail) };
};

const linkImage = (v: unknown): LinkImage | null => {
  if (!isObj(v)) return null;
  if (v.kind === 'url' && typeof v.url === 'string') return { kind: 'url', url: v.url };
  if (v.kind === 'path' && typeof v.path === 'string') return { kind: 'path', path: v.path };
  return null;
};

/** Missing item ids are filled deterministically (`item-<index>`, schema centre `central`). */
export function cardFromRow(row: CardRow): Card {
  const c: Json = isObj(row.content) ? row.content : {};
  const head = { id: row.id, position: row.position, title: row.title };
  switch (row.type) {
    case 'text':
      return { ...head, type: 'text', text: str(c.text) };
    case 'images':
      return {
        ...head,
        type: 'images',
        images: arr(c.images).map(
          (i): CardImage => ({ path: str(i.path), alt: str(i.alt), credit: strOrNull(i.credit) }),
        ),
        display: c.display === 'gallery' ? 'gallery' : 'single',
        text: strOrNull(c.text),
      };
    case 'video':
      return {
        ...head,
        type: 'video',
        youtubeId: str(c.youtubeId),
        startSeconds: numOrNull(c.startSeconds),
        endSeconds: numOrNull(c.endSeconds),
        text: strOrNull(c.text),
      };
    case 'timeline':
      return {
        ...head,
        type: 'timeline',
        points: arr(c.points).map(
          (p, i): TimelinePoint => ({
            id: id(p.id, `item-${i}`),
            date: str(p.date),
            title: str(p.title),
            details: strOrNull(p.details),
            key: p.key === true,
            imagePath: strOrNull(p.imagePath),
          }),
        ),
      };
    case 'schema':
      return {
        ...head,
        type: 'schema',
        causesLabel: str(c.causesLabel, 'Cauze'),
        consequencesLabel: str(c.consequencesLabel, 'Urmări'),
        causes: arr(c.causes).map((b, i) => box(b, `item-${i}`)),
        central: box(c.central, 'central'),
        consequences: arr(c.consequences).map((b, i) => box(b, `item-${i}`)),
      };
    case 'link':
      return {
        ...head,
        type: 'link',
        url: str(c.url),
        title: str(c.title, row.title ?? ''),
        description: strOrNull(c.description),
        image: linkImage(c.image),
        text: strOrNull(c.text),
      };
  }
}

export function cardToRow(card: DistributiveOmit<Card, 'id' | 'position'>): {
  title: string | null;
  type: CardType;
  content: Record<string, unknown>;
} {
  const { title, type, ...content } = card;
  // A link card's `title` is both the card title and the link title (one property), so it
  // also stays in `content` to keep the row self-describing.
  return { title, type, content: type === 'link' ? { ...content, title } : content };
}

/** Storage paths of images owned by the card (URL images are external and excluded). */
export function cardImagePaths(card: CardContent): string[] {
  switch (card.type) {
    case 'images':
      return card.images.map((i) => i.path);
    case 'timeline':
      return card.points.flatMap((p) => (p.imagePath ? [p.imagePath] : []));
    case 'link':
      return card.image?.kind === 'path' ? [card.image.path] : [];
    default:
      return [];
  }
}

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtube-nocookie.com',
]);
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/** Extracts the 11-char video id from a YouTube URL (or a bare id); null when not recognised. */
export function parseYouTubeId(input: string): string | null {
  const s = input.trim();
  if (YOUTUBE_ID.test(s)) return s;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (!YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) return null;
  let candidate: string | null = null;
  if (url.hostname.toLowerCase() === 'youtu.be') {
    candidate = url.pathname.split('/')[1] ?? null;
  } else if (url.pathname === '/watch') {
    candidate = url.searchParams.get('v');
  } else {
    const m = /^\/(?:shorts|embed)\/([^/]+)/.exec(url.pathname);
    candidate = m?.[1] ?? null;
  }
  return candidate && YOUTUBE_ID.test(candidate) ? candidate : null;
}

const blank = (s: string | null | undefined) => !s || s.trim() === '';
const hasDuplicates = (ids: string[]) => new Set(ids).size !== ids.length;

/** Returns Romanian error messages; empty array when the card is valid. */
export function validateCard(card: CardContent & { title?: string | null }): string[] {
  const errors: string[] = [];
  switch (card.type) {
    case 'text':
      if (blank(card.text)) errors.push('Textul nu poate fi gol.');
      break;
    case 'images':
      if (card.images.length === 0) errors.push('Adaugă cel puțin o imagine.');
      card.images.forEach((img, i) => {
        if (blank(img.alt)) errors.push(`Imaginea ${i + 1}: descrierea nu poate fi goală.`);
      });
      break;
    case 'video': {
      if (!YOUTUBE_ID.test(card.youtubeId)) errors.push('Linkul YouTube nu este valid.');
      const { startSeconds: s, endSeconds: e } = card;
      if ((s !== null && s < 0) || (e !== null && e < 0)) errors.push('Secundele nu pot fi negative.');
      else if (s !== null && e !== null && e <= s) {
        errors.push('Secunda de final trebuie să fie după cea de start.');
      }
      break;
    }
    case 'timeline':
      if (card.points.length < 2) errors.push('Axa cronologică are nevoie de cel puțin 2 puncte.');
      card.points.forEach((p, i) => {
        if (blank(p.date)) errors.push(`Punctul ${i + 1}: data nu poate fi goală.`);
        if (blank(p.title)) errors.push(`Punctul ${i + 1}: titlul nu poate fi gol.`);
      });
      if (hasDuplicates(card.points.map((p) => p.id))) {
        errors.push('Elementele trebuie să aibă identificatori unici.');
      }
      break;
    case 'schema': {
      if (card.causes.length === 0) errors.push('Schema are nevoie de cel puțin o cauză.');
      if (card.consequences.length === 0) errors.push('Schema are nevoie de cel puțin o urmare.');
      if (blank(card.central.text)) errors.push('Evenimentul central nu poate fi gol.');
      if ([...card.causes, ...card.consequences].some((b) => blank(b.text))) {
        errors.push('Căsuțele schemei nu pot fi goale.');
      }
      const boxIds = [...card.causes, card.central, ...card.consequences].map((b) => b.id);
      if (hasDuplicates(boxIds)) errors.push('Elementele trebuie să aibă identificatori unici.');
      break;
    }
    case 'link':
      if (!/^https?:\/\/\S+/i.test(card.url.trim())) {
        errors.push('Linkul trebuie să înceapă cu http:// sau https://.');
      }
      if (blank(card.title)) errors.push('Titlul linkului nu poate fi gol.');
      break;
  }
  return errors;
}
