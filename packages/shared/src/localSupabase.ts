const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);

/**
 * Guard for integration and e2e suites, which create and delete rows: refuses to run unless every configured
 * Supabase URL points at a local instance. Unset URLs are ignored unless `required` (the suite then can't run at all).
 */
export function assertLocalSupabase(
  suite: string,
  urls: Array<string | undefined>,
  opts: { required?: boolean } = {},
): void {
  const set = urls.filter((u): u is string => !!u);
  if (opts.required && set.length === 0) {
    throw new Error(`${suite} refuses to run: the Supabase URL is not set (expected local Supabase, see .env.example).`);
  }
  for (const url of set) {
    let host: string | undefined;
    try {
      host = new URL(url).hostname;
    } catch {
      host = undefined;
    }
    if (!host || !LOCAL_HOSTS.has(host)) {
      throw new Error(
        `${suite} refuses to run against ${url}: tests write and delete data, so the Supabase URL host must be ` +
          '127.0.0.1 or localhost. Point SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL at local Supabase (`pnpm db:start`).',
      );
    }
  }
}
