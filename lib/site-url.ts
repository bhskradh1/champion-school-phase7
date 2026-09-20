/*
 * The public address of the website (for example https://portal.championschool.edu.np).
 * Used to build the link inside invitation emails so it opens THIS website's
 * "Create your account" page.
 *
 * Best: set NEXT_PUBLIC_SITE_URL in your environment variables.
 * If it is missing, the address the admin is browsing from is used instead.
 */
export function getSiteUrl(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '');
  if (configured) return configured;

  const origin = request.headers.get('origin');
  if (origin) return origin;

  const forwardedHost = request.headers.get('x-forwarded-host');
  if (forwardedHost) {
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    return `${proto}://${forwardedHost}`;
  }

  return new URL(request.url).origin;
}
