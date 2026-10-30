import { createServerClient as createSsrClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/** Cookie-based Supabase client acting as the signed-in owner (RLS applies). */
export async function createServerClient() {
  const cookieStore = await cookies();
  return createSsrClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are read-only there; the proxy refreshes the session.
        }
      },
    },
  });
}
