// Sentry-agnostic PII scrubber, used as `beforeSend` by the student app and the admin.
// Structural types only: `shared` must not depend on any Sentry package.

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const EMAIL_TOKEN = '[email]';
const SENSITIVE_HEADERS = new Set(['authorization', 'cookie', 'set-cookie']);

// No index signatures: Sentry's event types are interfaces, which TypeScript does not treat as having one, so an
// index signature here would make `scrubEvent` unusable as `beforeSend`.
type ScrubbableEvent = {
  message?: string;
  request?: { headers?: Record<string, unknown>; data?: unknown; url?: string; query_string?: unknown };
  user?: { id?: unknown };
  exception?: { values?: Array<{ value?: string }> };
  breadcrumbs?: Array<{
    message?: string;
    data?: Record<string, unknown>;
  }>;
};

const scrubText = (s: string): string => s.replace(EMAIL_RE, EMAIL_TOKEN);

// In URLs an email ends at the next delimiter, so `?email=a@b.ro&next=/home` keeps `next`.
const URL_EMAIL_RE = /(?:[^\s@&#?=/%]|%(?!40))+(?:@|%40)[^\s@&#?=/]+\.[^\s@&#?=/]+/gi;
const SECRET_PARAM_RE = /(^|[?&#;])(access_token|refresh_token|token|code|password)=[^&#\s]*/gi;

// Redacts auth params (query and fragment) and emails; everything else stays intact.
const scrubUrl = (s: string): string =>
  s.replace(SECRET_PARAM_RE, '$1$2=[redacted]').replace(URL_EMAIL_RE, EMAIL_TOKEN);

const BREADCRUMB_URL_KEYS = ['url', 'to', 'from'];

export function scrubEvent<E extends ScrubbableEvent>(event: E): E {
  const out: ScrubbableEvent = { ...event };

  if (typeof out.message === 'string') out.message = scrubText(out.message);

  if (out.request) {
    const next: NonNullable<ScrubbableEvent['request']> = { ...out.request };
    delete next.data;
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

  if (out.user) out.user = out.user.id === undefined ? {} : { id: out.user.id };

  if (out.exception?.values) {
    out.exception = {
      ...out.exception,
      values: out.exception.values.map((v) =>
        typeof v.value === 'string' ? { ...v, value: scrubText(v.value) } : v,
      ),
    };
  }

  if (out.breadcrumbs) {
    out.breadcrumbs = out.breadcrumbs.map((b) => {
      const nb = { ...b };
      if (typeof nb.message === 'string') nb.message = scrubText(nb.message);
      if (nb.data) {
        const data = { ...nb.data };
        for (const k of BREADCRUMB_URL_KEYS) {
          const v = data[k];
          if (typeof v === 'string') data[k] = scrubUrl(v);
        }
        nb.data = data;
      }
      return nb;
    });
  }

  return out as E;
}
