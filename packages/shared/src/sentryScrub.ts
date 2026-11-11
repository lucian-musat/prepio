// Sentry-agnostic PII scrubber, used as `beforeSend` by the student app and the admin.
// Structural types only: `shared` must not depend on any Sentry package.

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const EMAIL_TOKEN = '[email]';
// Credentials, plus the client IP (PII) as proxies and Vercel forward it.
const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-forwarded-for',
  'x-real-ip',
  'cf-connecting-ip',
  'true-client-ip',
  'forwarded',
  'x-vercel-forwarded-for',
]);

// No index signatures: Sentry's event types are interfaces, which TypeScript does not treat as having one, so an
// index signature here would make `scrubEvent` unusable as `beforeSend`.
type ScrubbableEvent = {
  message?: string;
  request?: { headers?: Record<string, unknown>; data?: unknown; cookies?: unknown; url?: string; query_string?: unknown };
  user?: { id?: unknown };
  // `object`: Sentry's `Contexts` interface fits no narrower structural type; `nextjs` is narrowed at runtime.
  contexts?: object;
  exception?: { values?: Array<{ value?: string }> };
  breadcrumbs?: Array<ScrubbableBreadcrumb>;
};

const scrubText = (s: string): string => s.replace(EMAIL_RE, EMAIL_TOKEN);

// In URLs an email ends at the next delimiter, so `?email=a@b.ro&next=/home` keeps `next`.
const URL_EMAIL_RE = /(?:[^\s@&#?=/%]|%(?!40))+(?:@|%40)[^\s@&#?=/]+\.[^\s@&#?=/]+/gi;
const SECRET_PARAM_RE = /(^|[?&#;])(access_token|refresh_token|token|code|password)=[^&#\s]*/gi;
// Admin search terms can be student names; a decoded path keeps the space (`?q=Ana Popescu`), so take it all.
const SEARCH_PARAM_RE = /(^|[?&#;])(q|search)=[^&#]*/gi;

// Redacts auth params and search terms (query and fragment) and emails; everything else stays intact.
export const scrubUrl = (s: string): string =>
  s
    .replace(SECRET_PARAM_RE, '$1$2=[redacted]')
    .replace(SEARCH_PARAM_RE, '$1$2=[redacted]')
    .replace(URL_EMAIL_RE, EMAIL_TOKEN);

const BREADCRUMB_URL_KEYS = ['url', 'to', 'from'];

export function scrubEvent<E extends ScrubbableEvent>(event: E): E {
  const out: ScrubbableEvent = { ...event };

  if (typeof out.message === 'string') out.message = scrubText(out.message);

  if (out.request) {
    const next: NonNullable<ScrubbableEvent['request']> = { ...out.request };
    delete next.data;
    // `captureRequestError` sets the parsed cookies even without PII: the Supabase auth cookie holds tokens and the email.
    delete next.cookies;
    const { headers, url, query_string: qs } = out.request;
    if (typeof url === 'string') next.url = scrubUrl(url);
    if (typeof qs === 'string') next.query_string = scrubUrl(qs);
    else delete next.query_string;
    if (headers) {
      next.headers = Object.fromEntries(
        Object.entries(headers).filter(([k]) => !SENSITIVE_HEADERS.has(k.toLowerCase())),
      );
    }
    out.request = next;
  }

  const nextjs = (out.contexts as { nextjs?: unknown } | undefined)?.nextjs as { request_path?: unknown } | undefined;
  if (nextjs && typeof nextjs === 'object' && typeof nextjs.request_path === 'string') {
    out.contexts = { ...out.contexts, nextjs: { ...nextjs, request_path: scrubUrl(nextjs.request_path) } };
  }

  // The id only: drops email, username and `ip_address`.
  if (out.user) out.user = out.user.id === undefined ? {} : { id: out.user.id };

  if (out.exception?.values) {
    out.exception = {
      ...out.exception,
      values: out.exception.values.map((v) =>
        typeof v.value === 'string' ? { ...v, value: scrubText(v.value) } : v,
      ),
    };
  }

  if (out.breadcrumbs) out.breadcrumbs = out.breadcrumbs.map(scrubBreadcrumb);

  return out as E;
}

type ScrubbableBreadcrumb = { category?: string; message?: string; data?: Record<string, unknown> };

const CONSOLE_MESSAGE_MAX = 80;

/**
 * A console breadcrumb's message joins every logged argument, an Error as `${name}: ${message}`, and that text can
 * quote model output about a student's answer: keep the leading tag (`[bac/submit] failed`) up to the first `:`, or
 * at most 80 characters when there is none.
 */
function consoleMessage(message: string): string {
  const colon = message.indexOf(':');
  const lead = colon >= 0 ? message.slice(0, colon) : message;
  return scrubText(lead).slice(0, CONSOLE_MESSAGE_MAX);
}

/**
 * `beforeBreadcrumb`: emails in the message, auth params in url/to/from; console breadcrumbs keep only their leading
 * tag and lose their arguments.
 */
export function scrubBreadcrumb<B extends ScrubbableBreadcrumb>(breadcrumb: B): B {
  const out: ScrubbableBreadcrumb = { ...breadcrumb };
  if (typeof out.message === 'string') {
    out.message = out.category === 'console' ? consoleMessage(out.message) : scrubText(out.message);
  }
  if (out.data) {
    const data = { ...out.data };
    for (const k of BREADCRUMB_URL_KEYS) {
      const v = data[k];
      if (typeof v === 'string') data[k] = scrubUrl(v);
    }
    // Logged objects (profiles, API errors) can carry emails anywhere inside: keep the message, drop the arguments.
    if (out.category === 'console') delete data.arguments;
    out.data = data;
  }
  return out as B;
}

type ScrubbableSpan = { description?: string; data?: Record<string, unknown> };
// Browser fetch/navigation spans use `url` / `http.url`; Node (OpenTelemetry) server spans the `url.*` / `http.*` ones.
const SPAN_URL_KEYS = ['url', 'http.url', 'url.full', 'http.target', 'url.query', 'http.query', 'http.fragment'];

/** `beforeSendSpan`: page-load / navigation / fetch spans carry URLs (e.g. the OAuth return with `?code=`). Never null. */
export function scrubSpan<S extends ScrubbableSpan>(span: S): S {
  const out: ScrubbableSpan = { ...span };
  if (typeof out.description === 'string') out.description = scrubUrl(out.description);
  if (out.data) {
    const data = { ...out.data };
    for (const k of SPAN_URL_KEYS) {
      const v = data[k];
      if (typeof v === 'string') data[k] = scrubUrl(v);
    }
    out.data = data;
  }
  return out as S;
}
