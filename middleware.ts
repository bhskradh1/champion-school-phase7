import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// /signup is where invited people create their password (opened from the invitation email).
const PUBLIC_PATHS = ['/', '/login', '/signup', '/register'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // If Supabase isn't configured, let the request through (fallback UI).
  if (!url || !key) {
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        /*
         * PERFORMANCE / RELIABILITY FIX
         *
         * When the login token is refreshed, the NEW cookies must be passed
         * to the page that renders next. Otherwise the page sees the OLD
         * (expired) token, tries to refresh it a second time, and wastes a
         * network round trip (or randomly logs people out).
         *
         * This is the pattern recommended by Supabase for Next.js.
         */
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  /*
   * getClaims() verifies the JWT locally when your Supabase project uses
   * asymmetric JWT signing keys (no network call). See the README for how
   * to check this in the Supabase dashboard.
   */
  const { data: claimsData, error } = await supabase.auth.getClaims();
  const user = error || !claimsData?.claims ? null : claimsData.claims;

  const pathname = request.nextUrl.pathname;
  const isPublic =
    PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/auth/callback');

  // Keep any refreshed auth cookies when we redirect.
  const redirectTo = (path: string) => {
    const redirect = NextResponse.redirect(new URL(path, request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!user && !isPublic) {
    return redirectTo('/login');
  }

  if (user && pathname === '/login') {
    return redirectTo('/dashboard');
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
