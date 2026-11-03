import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { UserError } from '@/lib/data/db';
import { fetchLinkPreview, isPublicAddress, parseLinkMetadata } from './linkPreview';

const FAIL = 'Nu am putut citi pagina. Completează câmpurile manual.';
const PAGE = 'https://example.com/articles/one';

describe('parseLinkMetadata', () => {
  it('prefers Open Graph tags (attributes in any order, either quote style)', () => {
    const html = `<html><head><title>Plain title</title>
      <meta name="description" content="Plain description">
      <meta content='OG title' property='og:title'>
      <meta property="og:description" content="OG description" />
      <meta property="og:image" content="https://cdn.example.com/a.png">
    </head></html>`;
    expect(parseLinkMetadata(html, PAGE)).toEqual({
      title: 'OG title',
      description: 'OG description',
      imageUrl: 'https://cdn.example.com/a.png',
    });
  });

  it('falls back to <title> and meta description', () => {
    const html = `<head><TITLE>
      Plain title </TITLE><meta content="Plain description" name="Description"></head>`;
    expect(parseLinkMetadata(html, PAGE)).toEqual({ title: 'Plain title', description: 'Plain description', imageUrl: null });
  });

  it('returns nulls when nothing is found', () => {
    expect(parseLinkMetadata('<p>hi</p>', PAGE)).toEqual({ title: null, description: null, imageUrl: null });
  });

  it('resolves a relative og:image against the page URL', () => {
    const html = '<meta property="og:image" content="../img/cover.jpg?x=1&amp;y=2">';
    expect(parseLinkMetadata(html, PAGE).imageUrl).toBe('https://example.com/img/cover.jpg?x=1&y=2');
  });

  it('drops a non-http(s) og:image', () => {
    expect(parseLinkMetadata('<meta property="og:image" content="javascript:alert(1)">', PAGE).imageUrl).toBeNull();
    expect(parseLinkMetadata('<meta property="og:image" content="data:image/png;base64,AAA">', PAGE).imageUrl).toBeNull();
  });

  it('decodes HTML entities (&nbsp; is normalised to a plain space)', () => {
    const html = `<title>Tom &amp; Jerry &lt;3 &gt; &quot;x&quot; &#39;y&#39; &apos;z&apos;&nbsp;&#259;&#x219; &bogus;</title>`;
    expect(parseLinkMetadata(html, PAGE).title).toBe(`Tom & Jerry <3 > "x" 'y' 'z' ăș &bogus;`);
  });

  it('trims title to 200 and description to 500 characters', () => {
    const html = `<title>${'a'.repeat(300)}</title><meta name="description" content="${'b'.repeat(700)}">`;
    const r = parseLinkMetadata(html, PAGE);
    expect(r.title).toHaveLength(200);
    expect(r.description).toHaveLength(500);
  });
});

describe('isPublicAddress', () => {
  it.each([
    ['8.8.8.8', true],
    ['93.184.216.34', true],
    ['0.0.0.0', false],
    ['10.1.2.3', false],
    ['100.64.0.1', false],
    ['100.127.255.255', false],
    ['100.128.0.1', true],
    ['127.0.0.1', false],
    ['169.254.169.254', false],
    ['172.16.0.1', false],
    ['172.31.255.255', false],
    ['172.32.0.1', true],
    ['192.168.1.1', false],
    ['224.0.0.1', false],
    ['240.0.0.1', false],
    ['255.255.255.255', false],
    ['2606:4700:4700::1111', true],
    ['::', false],
    ['::1', false],
    ['fc00::1', false],
    ['fd12:3456::1', false],
    ['fe80::1', false],
    ['febf::1', false],
    ['::ffff:127.0.0.1', false],
    ['::ffff:10.0.0.1', false],
    ['::ffff:7f00:1', false],
    ['::ffff:8.8.8.8', true],
    ['not-an-ip', false],
  ])('%s → %s', (ip, expected) => {
    expect(isPublicAddress(ip)).toBe(expected);
  });
});

function htmlResponse(body: string, init: ResponseInit = {}) {
  return new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, ...init });
}
const publicLookup = vi.fn(async () => ['93.184.216.34']);

async function expectFail(p: Promise<unknown>) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(UserError);
  expect((err as Error).message).toBe(FAIL);
}

describe('fetchLinkPreview', () => {
  it('fetches and parses a public HTML page', async () => {
    const fetch = vi.fn(async () => htmlResponse('<title>Hello</title>'));
    const r = await fetchLinkPreview('https://example.com/', { lookup: publicLookup, fetch });
    expect(r).toEqual({ title: 'Hello', description: null, imageUrl: null });
    expect(fetch).toHaveBeenCalledWith('https://example.com/', expect.objectContaining({ redirect: 'manual' }));
  });

  it('rejects non-http(s) schemes and malformed URLs without fetching', async () => {
    const fetch = vi.fn();
    await expectFail(fetchLinkPreview('ftp://example.com/', { lookup: publicLookup, fetch }));
    await expectFail(fetchLinkPreview('file:///etc/passwd', { lookup: publicLookup, fetch }));
    await expectFail(fetchLinkPreview('not a url', { lookup: publicLookup, fetch }));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects private IP literals without a lookup', async () => {
    const fetch = vi.fn();
    const lookup = vi.fn(async () => ['93.184.216.34']);
    await expectFail(fetchLinkPreview('http://127.0.0.1/', { lookup, fetch }));
    await expectFail(fetchLinkPreview('http://[::1]:8080/', { lookup, fetch }));
    await expectFail(fetchLinkPreview('http://[::ffff:169.254.169.254]/', { lookup, fetch }));
    expect(lookup).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects a host name resolving to a private address', async () => {
    const fetch = vi.fn();
    await expectFail(fetchLinkPreview('http://localhost/', { lookup: async () => ['127.0.0.1'], fetch }));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects a host when any one of its addresses is private', async () => {
    const fetch = vi.fn();
    await expectFail(fetchLinkPreview('http://mixed.example/', { lookup: async () => ['93.184.216.34', '10.0.0.5'], fetch }));
    await expectFail(fetchLinkPreview('http://empty.example/', { lookup: async () => [], fetch }));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('follows a redirect after re-checking it, resolving relative Location', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: '/final' } }))
      .mockResolvedValueOnce(htmlResponse('<title>Final</title>'));
    const r = await fetchLinkPreview('https://example.com/start', { lookup: publicLookup, fetch });
    expect(r.title).toBe('Final');
    expect(fetch).toHaveBeenNthCalledWith(2, 'https://example.com/final', expect.anything());
  });

  it('rejects a redirect to a private address', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'http://10.0.0.1/admin' } }));
    await expectFail(fetchLinkPreview('https://example.com/', { lookup: publicLookup, fetch }));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects a redirect to a non-http scheme', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'file:///etc/passwd' } }));
    await expectFail(fetchLinkPreview('https://example.com/', { lookup: publicLookup, fetch }));
  });

  it('gives up after 3 redirects', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 302, headers: { location: '/again' } }));
    await expectFail(fetchLinkPreview('https://example.com/', { lookup: publicLookup, fetch }));
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('rejects error statuses and network failures', async () => {
    await expectFail(fetchLinkPreview('https://example.com/', { lookup: publicLookup, fetch: async () => htmlResponse('x', { status: 404 }) }));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expectFail(
      fetchLinkPreview('https://example.com/', {
        lookup: publicLookup,
        fetch: async () => {
          throw new TypeError('fetch failed');
        },
      }),
    );
    spy.mockRestore();
  });

  it('reads at most 1 MB of the body', async () => {
    // A stream that would deliver 2 MB; the reader must stop and cancel after ~1 MB.
    const chunk = new TextEncoder().encode('a'.repeat(64 * 1024));
    const head = '<title>Big</title>';
    let delivered = 0;
    let cancelled = false;
    const big = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode(head));
      },
      pull(c) {
        if (delivered >= 2 * 1024 * 1024) return c.close();
        delivered += chunk.byteLength;
        c.enqueue(chunk);
      },
      cancel() {
        cancelled = true;
      },
    });
    const r = await fetchLinkPreview('https://example.com/', {
      lookup: publicLookup,
      fetch: async () => new Response(big, { headers: { 'content-type': 'text/html' } }),
    });
    expect(r.title).toBe('Big');
    expect(cancelled).toBe(true);
    expect(delivered).toBeLessThanOrEqual(1024 * 1024 + chunk.byteLength);
  });

  it('cuts the parsed content at 1 MB', async () => {
    const padding = 'a'.repeat(1024 * 1024);
    const r = await fetchLinkPreview('https://example.com/', {
      lookup: publicLookup,
      fetch: async () => htmlResponse(`${padding}<title>Too late</title>`),
    });
    expect(r.title).toBeNull();
  });

  it('returns nulls for non-HTML content', async () => {
    const r = await fetchLinkPreview('https://example.com/file.pdf', {
      lookup: publicLookup,
      fetch: async () => new Response('<title>Nope</title>', { headers: { 'content-type': 'application/pdf' } }),
    });
    expect(r).toEqual({ title: null, description: null, imageUrl: null });
  });

  it('passes a timeout signal to fetch', async () => {
    const fetch = vi.fn(async () => htmlResponse('<title>T</title>'));
    await fetchLinkPreview('https://example.com/', { lookup: publicLookup, fetch });
    expect((fetch.mock.calls[0] as unknown[])[1]).toEqual(expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });
});
