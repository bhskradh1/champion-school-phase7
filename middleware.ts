import {
  type NextRequest,
  NextResponse,
} from 'next/server';

import { createServerClient } from '@supabase/ssr';

const PUBLIC_PATHS = [
  '/',
  '/login',
];

export async function middleware(
  request: NextRequest
) {
  const response =
    NextResponse.next({
      request,
    });

  const url =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  /*
   * If Supabase isn't configured, allow the request
   * through so the application can show its fallback UI.
   */
  if (!url || !key) {
    return response;
  }

  const supabase =
    createServerClient(
      url,
      key,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },

          setAll(
            cookiesToSet
          ) {
            cookiesToSet.forEach(
              ({
                name,
                value,
                options,
              }) => {
                request.cookies.set(
                  name,
                  value
                );

                response.cookies.set(
                  name,
                  value,
                  options
                );
              }
            );
          },
        },
      }
    );

  /*
   * IMPORTANT:
   *
   * getClaims() replaces getUser() here.
   * It verifies the authenticated JWT and can avoid
   * an Auth-server round trip with asymmetric keys.
   */
  const {
    data: claimsData,
    error,
  } =
    await supabase.auth.getClaims();

  const user =
    error || !claimsData?.claims
      ? null
      : claimsData.claims;

  const pathname =
    request.nextUrl.pathname;

  const isPublic =
    PUBLIC_PATHS.includes(
      pathname
    ) ||
    pathname.startsWith(
      '/auth/callback'
    );

  /*
   * Not authenticated:
   * send protected pages to login.
   */
  if (!user && !isPublic) {
    return NextResponse.redirect(
      new URL(
        '/login',
        request.url
      )
    );
  }

  /*
   * Already authenticated:
   * don't show login again.
   */
  if (
    user &&
    pathname === '/login'
  ) {
    return NextResponse.redirect(
      new URL(
        '/dashboard',
        request.url
      )
    );
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
