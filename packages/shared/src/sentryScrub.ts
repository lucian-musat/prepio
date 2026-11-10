// Sentry-agnostic PII scrubber, used as `beforeSend` by the student app and the admin.
// Structural types only: `shared` must not depend on any Sentry package.

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const EMAIL_TOKEN = '[email]';
const SENSITIVE_HEADERS = new Set(['authorization', 'cookie', 'set-cookie']);

type ScrubbableEvent = {
  message?: string;
  request?: { headers?: Record<string, unknown>; data?: unknown; [k: string]: unknown };
  user?: { id?: unknown; [k: string]: unknown };
  exception?: { values?: Array<{ value?: string; [k: string]: unknown }> };
  breadcrumbs?: Array<{ message?: string; [k: string]: unknown }>;
};

const scrubText = (s: string): string => s.replace(EMAIL_RE, EMAIL_TOKEN);

export function scrubEvent<E extends ScrubbableEvent>(event: E): E {
  const out: ScrubbableEvent = { ...event };

  if (typeof out.message === 'string') out.message = scrubText(out.message);

  if (out.request) {
    const { data: _data, headers, ...rest } = out.request;
    const next: NonNullable<ScrubbableEvent['request']> = { ...rest };
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
    out.breadcrumbs = out.breadcrumbs.map((b) =>
      typeof b.message === 'string' ? { ...b, message: scrubText(b.message) } : b,
    );
  }

  return out as E;
}
