import * as Sentry from '@sentry/react-native';
import { scrubEvent } from '@prepio/shared';
import { captureError, initSentry, setSentryUser } from './sentry';

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  setUser: jest.fn(),
  captureException: jest.fn(),
  wrap: jest.fn((c: unknown) => c),
}));

const DSN = 'https://key@o1.ingest.de.sentry.io/2';
const init = Sentry.init as jest.Mock;

afterEach(() => {
  delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  delete process.env.EXPO_PUBLIC_SENTRY_ENV;
  delete process.env.EXPO_PUBLIC_SENTRY_RELEASE;
  jest.clearAllMocks();
});

describe('without a DSN', () => {
  it('does not initialise and everything is a no-op', () => {
    expect(initSentry()).toBe(false);
    setSentryUser('u1');
    captureError(new Error('boom'));
    expect(init).not.toHaveBeenCalled();
    expect(Sentry.setUser).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('treats an empty DSN as missing', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = '';
    expect(initSentry()).toBe(false);
    expect(init).not.toHaveBeenCalled();
  });
});

describe('with a DSN', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = DSN;
  });

  it('initialises with no PII, a low trace rate and the shared scrubber', () => {
    expect(initSentry()).toBe(true);
    expect(init).toHaveBeenCalledTimes(1);
    const opts = init.mock.calls[0][0];
    expect(opts).toMatchObject({ dsn: DSN, sendDefaultPii: false, tracesSampleRate: 0.1 });
    expect(opts.beforeSend).toBe(scrubEvent);
    expect(opts.beforeSendTransaction).toBe(scrubEvent);
  });

  it('sends no trace headers to any host (admin API CORS, third-party Supabase)', () => {
    initSentry();
    expect(init.mock.calls[0][0].tracePropagationTargets).toEqual([]);
  });

  it('uses EXPO_PUBLIC_SENTRY_RELEASE when set and leaves the SDK default otherwise', () => {
    initSentry();
    expect('release' in init.mock.calls[0][0]).toBe(false);
    process.env.EXPO_PUBLIC_SENTRY_RELEASE = 'prepio-web@abc123';
    initSentry();
    expect(init.mock.calls[1][0].release).toBe('prepio-web@abc123');
  });

  it('scrubs OAuth codes and tokens from span URLs and descriptions', () => {
    initSentry();
    const { beforeSendSpan } = init.mock.calls[0][0];
    const out = beforeSendSpan({
      span_id: 's',
      trace_id: 't',
      start_timestamp: 0,
      description: 'https://prepio.ro/?code=secret',
      data: {
        url: 'https://prepio.ro/#access_token=tok&type=bearer',
        'http.url': 'https://x.supabase.co/auth/v1/token?refresh_token=r',
        'http.method': 'GET',
      },
    });
    expect(out.description).toBe('https://prepio.ro/?code=[redacted]');
    expect(out.data).toEqual({
      url: 'https://prepio.ro/#access_token=[redacted]&type=bearer',
      'http.url': 'https://x.supabase.co/auth/v1/token?refresh_token=[redacted]',
      'http.method': 'GET',
    });
  });

  it('keeps spans without data or description', () => {
    initSentry();
    const { beforeSendSpan } = init.mock.calls[0][0];
    const span = { span_id: 's', trace_id: 't', start_timestamp: 0 };
    expect(beforeSendSpan(span)).toEqual(span);
  });

  it('drops logged console arguments from breadcrumbs', () => {
    initSentry();
    const { beforeBreadcrumb } = init.mock.calls[0][0];
    const out = beforeBreadcrumb({
      category: 'console',
      message: 'profile ana@example.ro',
      data: { arguments: [{ email: 'ana@example.ro' }], logger: 'console' },
    });
    expect(out.data).toEqual({ logger: 'console' });
    expect(out.message).toBe('profile [email]');
  });

  it('defaults the environment to development', () => {
    initSentry();
    expect(init.mock.calls[0][0].environment).toBe('development');
  });

  it('uses EXPO_PUBLIC_SENTRY_ENV as the environment', () => {
    process.env.EXPO_PUBLIC_SENTRY_ENV = 'production';
    initSentry();
    expect(init.mock.calls[0][0].environment).toBe('production');
  });

  it('scrubs breadcrumbs before they are recorded', () => {
    initSentry();
    const { beforeBreadcrumb } = init.mock.calls[0][0];
    const out = beforeBreadcrumb({
      message: 'signed in as ana@example.ro',
      data: { url: 'https://x.ro/cb?code=secret&next=/home' },
    });
    expect(out.message).toBe('signed in as [email]');
    expect(out.data.url).toBe('https://x.ro/cb?code=[redacted]&next=/home');
  });

  it('identifies the user by id only, and clears it', () => {
    setSentryUser('u1');
    expect(Sentry.setUser).toHaveBeenLastCalledWith({ id: 'u1' });
    setSentryUser(null);
    expect(Sentry.setUser).toHaveBeenLastCalledWith(null);
  });

  it('captures errors', () => {
    const e = new Error('boom');
    captureError(e);
    expect(Sentry.captureException).toHaveBeenCalledWith(e, undefined);
  });

  it('captures errors that reached the error boundary as unhandled', () => {
    const e = new Error('boom');
    captureError(e, { handled: false });
    expect(Sentry.captureException).toHaveBeenCalledWith(e, { mechanism: { handled: false } });
  });
});
