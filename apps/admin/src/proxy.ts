import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Auth gate (Next 16 renamed `middleware` to `proxy`). /login and /api/* are public:
// /api/consolidation/evaluate is called by the student app and does its own checks.
function isPublic(pathname: string): boolean {
  return pathname === '/login' || pathname === '/api' || pathname.startsWith('/api/');
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // getUser() revalidates the session with Supabase (and refreshes cookies) instead of trusting the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isPublic(request.nextUrl.pathname)) return response;
  if (!user) return NextResponse.redirect(new URL('/login', request.url));

  // Students sign in to the same Supabase project: a session alone is not enough, it must be an admin's.
  const { data: isAdmin, error } = await supabase.rpc('is_admin');
  if (error || isAdmin !== true) {
    // Local scope: drop only this browser session, not the student's sessions in the app.
    await supabase.auth.signOut({ scope: 'local' });
    const redirect = NextResponse.redirect(new URL('/login?error=not_admin', request.url));
    // signOut() cleared the auth cookies on `response` via setAll; carry them over to the redirect.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
