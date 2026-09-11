/**
 * API route prefixes that bypass the custom app_access_token check entirely:
 * - /api/auth/*     — NextAuth endpoints (login, callback, session, signout)
 * - /api/webhooks/* — GitHub webhook ingestion (uses its own HMAC signature check)
 * - /api/cron/*     — Scheduled sync triggers (Vercel Cron, GitHub Actions, curl).
 *                     These callers have no browser session/cookie; the route
 *                     itself gates access with its own CRON_SECRET check.
 */
export const PUBLIC_API_PREFIXES = ["/api/auth", "/api/webhooks", "/api/cron"];

export function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
