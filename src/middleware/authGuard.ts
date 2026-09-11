import { NextRequest, NextResponse } from "next/server";
import { validateToken } from "@/lib/auth/tokenService";
import { createLogger } from "@/lib/core/logger";

const log = createLogger("Middleware");

export type AuthGuardResult =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

/**
 * In development, the custom app_access_token check is skipped entirely —
 * route handlers already verify the session via getServerSession(). Kept as
 * an explicit, logged decision (rather than a silent branch) so it's obvious
 * in the terminal whenever auth is being bypassed.
 */
export function isDevBypass(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function logDevBypass(pathname: string): void {
  log.warn("Dev bypass — skipping app_access_token check for %s", pathname);
}

/**
 * Validates the app_access_token cookie (signature + expiry, no DB call — fast
 * enough to run on every request in the edge runtime).
 */
export function checkAppAccessToken(req: NextRequest): AuthGuardResult {
  const { pathname } = req.nextUrl;
  const accessToken = req.cookies.get("app_access_token")?.value;

  if (!accessToken) {
    log.warn("Rejected %s — no app_access_token cookie", pathname);
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 }),
    };
  }

  try {
    const secret = process.env.NEXTAUTH_SECRET ?? "";
    const { userId } = validateToken(accessToken, secret);
    return { ok: true, userId };
  } catch (err: any) {
    const isExpired = err?.message === "Token expired";
    log.warn("Rejected %s — %s", pathname, isExpired ? "token expired" : "invalid token");
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: isExpired ? "Access token expired" : "Invalid token",
          code: isExpired ? "TOKEN_EXPIRED" : "UNAUTHORIZED",
        },
        { status: 401 }
      ),
    };
  }
}
