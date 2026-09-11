import crypto from "crypto";
import { db } from "@/lib/db";

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;           // 15 minutes
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const ACCESS_SECRET = process.env.NEXTAUTH_SECRET ?? "";
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET ?? "";

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Build a signed token: "<randomHex>.<userId>.<expiresAtMs>.<hmac>"
 * The HMAC covers all three leading parts so tampering is detectable.
 */
function buildToken(userId: string, expiresAt: Date, secret: string): string {
  const rand = crypto.randomBytes(32).toString("hex");
  const exp = expiresAt.getTime().toString();
  const payload = `${rand}.${userId}.${exp}`;
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

/**
 * Validate a signed token.
 * Returns { userId, expiresAt } on success, throws on any failure.
 */
export function validateToken(
  token: string,
  secret: string
): { userId: string; expiresAt: Date } {
  const parts = token.split(".");
  if (parts.length !== 4) throw new Error("Malformed token");

  const [rand, userId, exp, sig] = parts;
  const payload = `${rand}.${userId}.${exp}`;
  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  // Constant-time comparison to prevent timing attacks
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
    throw new Error("Invalid token signature");
  }

  const expiresAt = new Date(parseInt(exp, 10));
  if (isNaN(expiresAt.getTime())) throw new Error("Invalid expiry in token");
  if (expiresAt < new Date()) throw new Error("Token expired");

  return { userId, expiresAt };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a fresh access+refresh token pair for the given user,
 * upsert them into the UserToken table, and return the raw token strings.
 */
export async function issueTokenPair(userId: string): Promise<{
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}> {
  const now = new Date();
  const accessTokenExpiresAt = new Date(now.getTime() + ACCESS_TOKEN_TTL_MS);
  const refreshTokenExpiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL_MS);

  const accessToken = buildToken(userId, accessTokenExpiresAt, ACCESS_SECRET);
  const refreshToken = buildToken(userId, refreshTokenExpiresAt, REFRESH_SECRET);

  // Upsert: one active token pair per user at all times
  await db.userToken.upsert({
    where: { userId },
    create: { userId, accessToken, refreshToken, accessTokenExpiresAt, refreshTokenExpiresAt },
    update: { accessToken, refreshToken, accessTokenExpiresAt, refreshTokenExpiresAt },
  });

  return { accessToken, refreshToken, accessTokenExpiresAt, refreshTokenExpiresAt };
}

/**
 * Validate an access token against the DB.
 * Throws if signature invalid, expired, or token was revoked.
 * Returns userId on success.
 */
export async function validateAccessToken(token: string): Promise<string> {
  const { userId } = validateToken(token, ACCESS_SECRET);

  const row = await db.userToken.findUnique({ where: { userId } });
  if (!row || row.accessToken !== token) {
    throw new Error("Access token revoked or not found");
  }

  return userId;
}

/**
 * Rotate the refresh token: validate the old token, issue a fresh pair.
 * The old pair is atomically replaced. Throws if the token is invalid,
 * expired, or has already been rotated (one-time-use guarantee).
 */
export async function rotateRefreshToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}> {
  const { userId } = validateToken(refreshToken, REFRESH_SECRET);

  const row = await db.userToken.findUnique({ where: { userId } });
  if (!row || row.refreshToken !== refreshToken) {
    throw new Error("Refresh token already rotated or revoked");
  }

  // issueTokenPair upserts, replacing the old pair atomically
  return issueTokenPair(userId);
}

/**
 * Revoke all tokens for the user — must be called on sign-out.
 */
export async function revokeUserTokens(userId: string): Promise<void> {
  await db.userToken.deleteMany({ where: { userId } });
}
