import 'server-only';
import { promises as dns } from 'node:dns';
import { isIP } from 'node:net';
import { UserError } from '@/lib/data/db';

/**
 * Server-side fetch of a user-supplied URL for the Link card preview. The URL comes from the
 * browser, so this is an SSRF surface: only http(s), every resolved address must be public
 * (re-checked on each redirect hop), bounded time, hops and body size.
 *
 * Residual risk: the address check and the connection made by `fetch` resolve DNS separately,
 * so a DNS-rebinding host could answer differently the second time. Pinning the vetted IP would
 * need an undici dispatcher (not a dependency). Exposure is limited: admin-only, GET only, and
 * only parsed title/description/image URL are returned, never the raw body.
 */

export type LinkMetadata = { title: string | null; description: string | null; imageUrl: string | null };

export type LinkPreviewDeps = {
  lookup?: (host: string) => Promise<string[]>;
  fetch?: typeof fetch;
};

const FAIL_MESSAGE = 'Nu am putut citi pagina. Completează câmpurile manual.';
const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 1024 * 1024;
const TIMEOUT_MS = 5000;
const TITLE_MAX = 200;
const DESCRIPTION_MAX = 500;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

// ---------------------------------------------------------------- addresses

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, part) => acc * 256 + Number(part), 0);
}

function isPublicIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  const inRange = (base: string, bits: number) => {
    const size = 2 ** (32 - bits);
    return Math.floor(n / size) === Math.floor(ipv4ToInt(base) / size);
  };
  return !(
    inRange('0.0.0.0', 8) ||
    inRange('10.0.0.0', 8) ||
    inRange('100.64.0.0', 10) ||
    inRange('127.0.0.0', 8) ||
    inRange('169.254.0.0', 16) ||
    inRange('172.16.0.0', 12) ||
    inRange('192.168.0.0', 16) ||
    inRange('224.0.0.0', 4) ||
    inRange('240.0.0.0', 4)
  );
}

/** Expands an IPv6 address (optionally with a trailing dotted IPv4) into 8 16-bit groups. */
function ipv6Groups(ip: string): number[] {
  let s = ip.toLowerCase().split('%')[0];
  const dotted = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const n = ipv4ToInt(dotted[1]);
    s = s.slice(0, -dotted[1].length) + `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const [head, tail] = s.split('::');
  const parse = (part: string | undefined) => (part ? part.split(':').map((g) => parseInt(g, 16)) : []);
  const left = parse(head);
  const right = parse(tail);
  const zeros = tail === undefined ? [] : new Array(8 - left.length - right.length).fill(0);
  return [...left, ...zeros, ...right];
}

function isPublicIPv6(ip: string): boolean {
  const g = ipv6Groups(ip);
  if (g.length !== 8) return false;
  const embeddedV4 = () => `${g[6] >> 8}.${g[6] & 0xff}.${g[7] >> 8}.${g[7] & 0xff}`;
  const firstSixZero = g.slice(0, 6).every((x) => x === 0);
  // ::ffff:a.b.c.d (IPv4-mapped) and 64:ff9b::a.b.c.d (NAT64) reach an IPv4 host: judge that host.
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return isPublicIPv4(embeddedV4());
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return isPublicIPv4(embeddedV4());
  if (firstSixZero && g[6] === 0 && (g[7] === 0 || g[7] === 1)) return false; // :: and ::1
  if ((g[0] & 0xfe00) === 0xfc00) return false; // fc00::/7 unique local
  if ((g[0] & 0xffc0) === 0xfe80) return false; // fe80::/10 link local
  if ((g[0] & 0xff00) === 0xff00) return false; // ff00::/8 multicast
  return true;
}

/** True only for a syntactically valid IP outside private, loopback, link-local, CGNAT, multicast and reserved ranges. */
export function isPublicAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPublicIPv4(ip);
  if (version === 6) return isPublicIPv6(ip);
  return false;
}

// ---------------------------------------------------------------- parsing

const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

function clean(raw: string | undefined, max: number): string | null {
  if (raw === undefined) return null;
  const text = decodeEntities(raw).replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, max) : null;
}

function metaTags(html: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs: Record<string, string> = {};
    for (const m of tag.matchAll(/([a-z][a-z0-9:_-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi)) {
      attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
    }
    const key = (attrs.property ?? attrs.name)?.toLowerCase();
    if (key && attrs.content !== undefined && !found.has(key)) found.set(key, attrs.content);
  }
  return found;
}

function httpUrl(raw: string | undefined, base: string): string | null {
  if (!raw) return null;
  try {
    const url = new URL(decodeEntities(raw).trim(), base);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function parseLinkMetadata(html: string, pageUrl: string): LinkMetadata {
  const meta = metaTags(html);
  const titleTag = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return {
    title: clean(meta.get('og:title'), TITLE_MAX) ?? clean(titleTag, TITLE_MAX),
    description: clean(meta.get('og:description'), DESCRIPTION_MAX) ?? clean(meta.get('description'), DESCRIPTION_MAX),
    imageUrl: httpUrl(meta.get('og:image'), pageUrl),
  };
}

// ---------------------------------------------------------------- fetching

/** Rejected by policy (scheme, address, status, hops): not logged as an unexpected error. */
class Refused extends Error {}

async function defaultLookup(host: string): Promise<string[]> {
  const records = await dns.lookup(host, { all: true, verbatim: true });
  return records.map((r) => r.address);
}

function withSignal<T>(p: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    p.then(resolve, reject);
  });
}

async function assertSafeUrl(url: URL, lookup: (host: string) => Promise<string[]>, signal: AbortSignal) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Refused(`scheme ${url.protocol}`);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [host] : await withSignal(lookup(host), signal);
  if (addresses.length === 0 || !addresses.every(isPublicAddress)) throw new Refused(`non-public address for ${host}`);
}

async function readCapped(res: Response): Promise<Uint8Array> {
  const out = new Uint8Array(MAX_BODY_BYTES);
  let length = 0;
  if (!res.body) return out.subarray(0, 0);
  const reader = res.body.getReader();
  try {
    while (length < MAX_BODY_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      const take = Math.min(value.byteLength, MAX_BODY_BYTES - length);
      out.set(value.subarray(0, take), length);
      length += take;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return out.subarray(0, length);
}

function decodeBody(bytes: Uint8Array, contentType: string): string {
  const charset = contentType.match(/charset\s*=\s*"?([\w-]+)/i)?.[1];
  try {
    return new TextDecoder(charset ?? 'utf-8').decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

export async function fetchLinkPreview(rawUrl: string, deps: LinkPreviewDeps = {}): Promise<LinkMetadata> {
  const lookup = deps.lookup ?? defaultLookup;
  const doFetch = deps.fetch ?? fetch;
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  try {
    let url = new URL(String(rawUrl).trim());
    for (let hop = 0; ; hop++) {
      await assertSafeUrl(url, lookup, signal);
      const res = await doFetch(url.href, {
        redirect: 'manual',
        signal,
        headers: { accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1' },
      });
      if (REDIRECT_STATUSES.has(res.status)) {
        await res.body?.cancel().catch(() => {});
        const location = res.headers.get('location');
        if (!location || hop >= MAX_REDIRECTS) throw new Refused(`redirect ${res.status} at hop ${hop}`);
        url = new URL(location, url);
        continue;
      }
      if (!res.ok) {
        await res.body?.cancel().catch(() => {});
        throw new Refused(`status ${res.status}`);
      }
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.toLowerCase().includes('text/html')) {
        await res.body?.cancel().catch(() => {});
        return { title: null, description: null, imageUrl: null };
      }
      return parseLinkMetadata(decodeBody(await readCapped(res), contentType), url.href);
    }
  } catch (e) {
    if (!(e instanceof Refused) && !(e instanceof TypeError && e.message.includes('Invalid URL'))) {
      console.error('[linkPreview] fetch failed:', e);
    }
    throw new UserError(FAIL_MESSAGE);
  }
}
