import { NextRequest, NextResponse } from "next/server";
import { rotateRefreshToken } from "@/lib/auth/tokenService";
import { setTokenCookies } from "@/lib/auth/auth";
import { createLogger } from "@/lib/core/logger";

const log = createLogger("AuthRefresh");

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/refresh
 *
 * Rotates the refresh token:
 * - Reads `app_refresh_token` httpOnly cookie
 * - Validates signature + expiry + DB presence
 * - Issues a brand-new access+refresh pair (old pair deleted)
 * - Sets fresh httpOnly cookies on the response
 *
 * Clients should call this when they receive a 401 { code: "TOKEN_EXPIRED" }
 * from any protected API route. If this endpoint itself returns 401, the
 * client must sign out and redirect to login.
 */
export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get("app_refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json(
      { error: "No refresh token", code: "REFRESH_EXPIRED" },
      { status: 401 }
    );
  }

  try {
    const { accessToken, refreshToken: newRefreshToken, accessTokenExpiresAt, refreshTokenExpiresAt } =
      await rotateRefreshToken(refreshToken);

    // Build the response first, then set cookies on it
    const res = NextResponse.json({ ok: true });

    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
    };

    res.cookies.set("app_access_token", accessToken, {
      ...cookieOpts,
      expires: accessTokenExpiresAt,
    });
    res.cookies.set("app_refresh_token", newRefreshToken, {
      ...cookieOpts,
      expires: refreshTokenExpiresAt,
    });

    log.success("Rotated app session token pair");
    return res;
  } catch (err: any) {
    log.warn("Refresh token rotation failed: %s", err?.message);

    // Clear cookies so the client cleans up automatically
    const res = NextResponse.json(
      { error: "Refresh token expired or invalid", code: "REFRESH_EXPIRED" },
      { status: 401 }
    );
    res.cookies.delete("app_access_token");
    res.cookies.delete("app_refresh_token");
    return res;
  }
}
