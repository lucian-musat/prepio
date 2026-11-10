import { describe, expect, it } from 'vitest';
import { scrubEvent } from './sentryScrub';

describe('scrubEvent', () => {
  const make = () => ({
    message: 'Failed for ana@example.com today',
    request: {
      url: 'https://prepio.ro/x',
      headers: { Authorization: 'Bearer abc', cookie: 'sb=1', Accept: 'json' },
      data: { password: 'secret' },
    },
    user: { id: 'u1', email: 'ana@example.com', username: 'ana', ip_address: '1.2.3.4' },
    exception: { values: [{ type: 'Error', value: 'bad user bob@school.ro here' }] },
    breadcrumbs: [{ message: 'GET /u for c@d.io', category: 'http' }],
  });

  it('strips auth headers, cookies and request data', () => {
    const out = scrubEvent(make());
    expect(out.request?.headers).toEqual({ Accept: 'json' });
    expect(out.request).not.toHaveProperty('data');
    expect(out.request?.url).toBe('https://prepio.ro/x');
  });

  it('keeps only user.id', () => {
    expect(scrubEvent(make()).user).toEqual({ id: 'u1' });
  });

  it('replaces emails in message, exception values and breadcrumbs', () => {
    const out = scrubEvent(make());
    expect(out.message).toBe('Failed for [email] today');
    expect(out.exception?.values?.[0]?.value).toBe('bad user [email] here');
    expect(out.breadcrumbs?.[0]?.message).toBe('GET /u for [email]');
  });

  it('does not mutate the input', () => {
    const e = make();
    scrubEvent(e);
    expect(e).toEqual(make());
  });

  it('scrubs emails and auth params in request.url (query and fragment)', () => {
    const out = scrubEvent({
      request: {
        url: 'https://prepio.ro/cb?email=ana@x.ro&next=/home#access_token=abc&refresh_token=def',
      },
    });
    expect(out.request?.url).toBe(
      'https://prepio.ro/cb?email=[email]&next=/home#access_token=[redacted]&refresh_token=[redacted]',
    );
  });

  it('redacts param names case-insensitively and leaves other params', () => {
    const out = scrubEvent({ request: { url: 'https://a.ro/?Code=1&token=2&password=3&page=4' } });
    expect(out.request?.url).toBe('https://a.ro/?Code=[redacted]&token=[redacted]&password=[redacted]&page=4');
  });

  it('scrubs a string query_string and drops a non-string one', () => {
    expect(scrubEvent({ request: { query_string: 'code=xyz&a=1' } }).request?.query_string).toBe(
      'code=[redacted]&a=1',
    );
    const out = scrubEvent({ request: { query_string: [['code', 'xyz']] } });
    expect(out.request).not.toHaveProperty('query_string');
  });

  it('scrubs url/to/from in breadcrumb data', () => {
    const out = scrubEvent({
      breadcrumbs: [
        {
          category: 'navigation',
          data: { from: '/a#access_token=t1', to: '/b?code=c1&x=1', url: '/c?e=u@v.ro', other: 'u@v.ro' },
        },
      ],
    });
    expect(out.breadcrumbs?.[0]?.data).toEqual({
      from: '/a#access_token=[redacted]',
      to: '/b?code=[redacted]&x=1',
      url: '/c?e=[email]',
      other: 'u@v.ro',
    });
  });

  it('removes mixed-case sensitive headers', () => {
    const out = scrubEvent({
      request: { headers: { COOKIE: 'a', 'Set-Cookie': 'b', AUTHORIZATION: 'c', Accept: 'x' } },
    });
    expect(out.request?.headers).toEqual({ Accept: 'x' });
  });

  it('replaces two emails in one message', () => {
    expect(scrubEvent({ message: 'a@b.ro and c@d.io failed' }).message).toBe('[email] and [email] failed');
  });

  it('handles events with none of the fields', () => {
    expect(scrubEvent({})).toEqual({});
  });
});
