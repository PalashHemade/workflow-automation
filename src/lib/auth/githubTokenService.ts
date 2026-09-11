import { db } from "../core/db";
import { createLogger } from "../core/logger";

const log = createLogger("GitHubAuth");

// Refresh a little early so a token doesn't die mid-request.
const REFRESH_BUFFER_SECONDS = 60;

/**
 * Returns a valid GitHub OAuth access token for the given user, refreshing it
 * first if it has expired (or is about to). Mirrors getValidJiraAccessToken's
 * pattern in src/lib/jira/jira.ts.
 *
 * GitHub OAuth Apps without "token expiration" enabled never set expires_at —
 * those tokens are long-lived and are returned as-is with no refresh attempt.
 */
export async function getValidGithubAccessToken(userId: string): Promise<string> {
  const account = await db.account.findFirst({
    where: { userId, provider: "github" },
  });

  if (!account || !account.access_token) {
    log.error("No GitHub account/access_token on file for user %s", userId);
    throw new Error("GitHub account not connected for this user. Please sign in with GitHub.");
  }

  if (!account.expires_at) {
    log.info("No expiry configured for user %s's GitHub token — using cached token", userId);
    return account.access_token;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const isExpired = account.expires_at <= nowSeconds + REFRESH_BUFFER_SECONDS;

  if (!isExpired) {
    return account.access_token;
  }

  if (!account.refresh_token) {
    log.error(
      "GitHub token expired for user %s and no refresh_token is stored — user must sign out and back in",
      userId
    );
    throw new Error("GitHub access token expired and no refresh token is available. Please sign out and sign back in.");
  }

  log.warn("GitHub token expired for user %s — attempting refresh...", userId);

  try {
    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: account.refresh_token,
      }),
    });

    const data: any = await res.json();

    if (!res.ok || !data.access_token || data.error) {
      throw new Error(data.error_description || data.error || `GitHub responded with status ${res.status}`);
    }

    const newExpiresAt = data.expires_in ? nowSeconds + Number(data.expires_in) : null;

    await db.account.updateMany({
      where: { userId, provider: "github" },
      data: {
        access_token: data.access_token,
        refresh_token: data.refresh_token ?? account.refresh_token,
        expires_at: newExpiresAt,
        // Unlike refresh_token/token_type/scope, this is a raw "seconds from now"
        // duration with no anchor timestamp — carrying forward a stale value here
        // (rather than omitting it) would silently understate how soon the refresh
        // token actually expires the longer it goes unrefreshed. Only ever write a
        // freshly-reported duration; leave the existing value alone otherwise.
        ...(data.refresh_token_expires_in ? { refresh_token_expires_in: Number(data.refresh_token_expires_in) } : {}),
        token_type: data.token_type ?? account.token_type,
        scope: data.scope ?? account.scope,
      },
    });

    log.success("Refreshed GitHub token for user %s (expires in %ss)", userId, data.expires_in ?? "n/a");

    return data.access_token;
  } catch (err: any) {
    log.error(
      "Failed to refresh GitHub token for user %s: %s — falling back to the stale token",
      userId,
      err?.message ?? err
    );
    // Same resilience pattern as Jira: don't hard-crash a caller (e.g. a background
    // sync) over a transient refresh failure. The stale token will most likely 401
    // downstream, but that's a clearer failure than losing the whole sync run here.
    return account.access_token;
  }
}
