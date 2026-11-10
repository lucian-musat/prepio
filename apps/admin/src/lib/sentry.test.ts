import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Sentry from '@sentry/nextjs';
import { scrubBreadcrumb, scrubEvent, scrubSpan } from '@prepio/shared';
import { captureBoundaryError, captureError, captureFailure, initSentry, sentryOptions } from './sentry';

vi.mock('@sentry/nextjs', () => ({ init: vi.fn(), captureException: vi.fn() }));

const DSN = 'https://key@o1.ingest.de.sentry.io/2';
const init = vi.mocked(Sentry.init);
const captureException = vi.mocked(Sentry.captureException);

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');
  vi.stubEnv('VERCEL_ENV', '');
  vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('without a DSN', () => {
  it('does not initialise and captureError is a no-op', () => {
    expect(initSentry()).toBe(false);
    captureError(new Error('boom'), { route: 'x' });
    captureBoundaryError(new Error('boom'));
    captureFailure('bac/submit', 'grade', new Error('boom'), 502);
    expect(init).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });
});

describe('with a DSN', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', DSN);
  });

  it('initialises once with the shared options', () => {
    expect(initSentry()).toBe(true);
    expect(init).toHaveBeenCalledTimes(1);
    expect(init.mock.calls[0][0]).toEqual(sentryOptions());
  });

  it('sends no PII, samples 10% of traces and scrubs every payload', () => {
    const opts = sentryOptions();
    expect(opts).toMatchObject({ dsn: DSN, sendDefaultPii: false, tracesSampleRate: 0.1, tracePropagationTargets: [] });
    expect(opts.beforeSend).toBe(scrubEvent);
    expect(opts.beforeSendTransaction).toBe(scrubEvent);
    expect(opts.beforeSendSpan).toBe(scrubSpan);
    expect(opts.beforeBreadcrumb).toBe(scrubBreadcrumb);
  });
  it('defaults the environment to development and uses the Vercel one when set', () => {
    expect(sentryOptions().environment).toBe('development');
    vi.stubEnv('VERCEL_ENV', 'preview');
    expect(sentryOptions().environment).toBe('preview');
    vi.stubEnv('VERCEL_ENV', '');
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'production');
    expect(sentryOptions().environment).toBe('production');
  });

  it('captures the error once with its tags', () => {
    const e = new Error('boom');
    captureError(e, { route: 'bac/submit' });
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(e, { tags: { route: 'bac/submit' } });
  });

  it('captures without tags', () => {
    const e = new Error('boom');
    captureError(e);
    expect(captureException).toHaveBeenCalledWith(e, undefined);
  });

  it('captureFailure sends route:stage with tags and never the original message', () => {
    class APIConnectionTimeoutError extends Error {}
    captureFailure('bac/submit', 'grade', new APIConnectionTimeoutError('model said: student wrote ana@x.ro'), 502);
    expect(captureException).toHaveBeenCalledTimes(1);
    const [sent, hint] = captureException.mock.calls[0]!;
    expect(sent).toBeInstanceOf(Error);
    expect((sent as Error).message).toBe('bac/submit:grade');
    expect((sent as Error).cause).toBeUndefined();
    expect(hint).toEqual({ tags: { route: 'bac/submit', stage: 'grade', cause: 'APIConnectionTimeoutError', status: '502' } });
    expect(JSON.stringify(captureException.mock.calls)).not.toContain('student wrote');
  });

  it('captureFailure tags the cause as none without an error, and omits a missing status', () => {
    captureFailure('credits/purchase', 'rpc_empty');
    expect(captureException.mock.calls[0]![1]).toEqual({ tags: { route: 'credits/purchase', stage: 'rpc_empty', cause: 'none' } });
  });

  it('captureFailure names plain objects and odd names generically', () => {
    captureFailure('r', 's', { message: 'rpc down', code: '42' });
    captureFailure('r', 's', Object.assign(new Error('x'), { name: 'name with ana@x.ro' }));
    captureFailure('r', 's', 'a string');
    expect(captureException.mock.calls.map((c) => (c[1] as { tags: { cause: string } }).tags.cause)).toEqual([
      'object',
      'Error',
      'string',
    ]);
  });

  it('marks errors that reached an error boundary as unhandled', () => {
    const e = new Error('boom');
    captureBoundaryError(e);
    expect(captureException).toHaveBeenCalledWith(e, { mechanism: { handled: false } });
  });
});
