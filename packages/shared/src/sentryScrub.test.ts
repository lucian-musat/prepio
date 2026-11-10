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

  it('handles events with none of the fields', () => {
    expect(scrubEvent({})).toEqual({});
  });
});
