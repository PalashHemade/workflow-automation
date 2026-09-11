import { NextRequest, NextResponse } from "next/server";
import { validateToken } from "@/lib/tokenService";

/**
 * Routes that bypass the custom token check entirely:
 * - /api/auth/*   — NextAuth endpoints (login, callback, session, signout)
 * - /api/webhooks/* — GitHub webhook ingestion (uses its own HMAC signature check)
 */
const PUBLIC_API_PREFIXES = ["/api/auth", "/api/webhooks"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only gate API routes
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Skip public API routes
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const accessToken = req.cookies.get("app_access_token")?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  // Validate signature + expiry directly in the middleware (no DB call — fast)
  try {
    const secret = process.env.NEXTAUTH_SECRET ?? "";
    const { userId } = validateToken(accessToken, secret);

    // Forward userId to API route handlers via a request header
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-user-id", userId);
    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch (err: any) {
    const isExpired = err?.message === "Token expired";
    return NextResponse.json(
      {
        error: isExpired ? "Access token expired" : "Invalid token",
        code: isExpired ? "TOKEN_EXPIRED" : "UNAUTHORIZED",
      },
      { status: 401 }
    );
  }
}

export const config = {
  matcher: ["/api/:path*"],
};
