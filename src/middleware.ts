import { NextRequest, NextResponse } from "next/server";
import { isPublicApiRoute } from "./middleware/publicRoutes";
import { checkAppAccessToken, isDevBypass, logDevBypass } from "./middleware/authGuard";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only gate API routes
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Skip public API routes (NextAuth, GitHub webhooks — each has its own auth mechanism)
  if (isPublicApiRoute(pathname)) {
    return NextResponse.next();
  }

  // In development, route handlers already verify the session themselves
  if (isDevBypass()) {
    logDevBypass(pathname);
    return NextResponse.next();
  }

  const result = checkAppAccessToken(req);
  if (!result.ok) {
    return result.response;
  }

  // Forward userId to API route handlers via a request header
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-user-id", result.userId);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/api/:path*"],
};
