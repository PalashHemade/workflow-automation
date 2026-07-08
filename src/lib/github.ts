declare global {
  var lastRateLimitRemaining: number | undefined;
  var lastRateLimitReset: Date | undefined;
}

interface GitHubFetchOptions {
  headers?: Record<string, string>;
  method?: string;
  body?: string;
}

/**
 * Standard fetch helper that handles authorization headers and tracks GitHub API rate limits.
 */
export async function fetchGitHub(
  url: string,
  accessToken: string,
  options: GitHubFetchOptions = {}
): Promise<Response> {
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${accessToken}`,
    "User-Agent": "github-analytics-dashboard",
    ...options.headers,
  };

  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body,
  });

  // Extract rate-limit response headers
  const remaining = response.headers.get("x-ratelimit-remaining");
  const reset = response.headers.get("x-ratelimit-reset");

  if (remaining !== null) {
    const remainingVal = parseInt(remaining, 10);
    const resetTime = reset ? new Date(parseInt(reset, 10) * 1000) : new Date();

    globalThis.lastRateLimitRemaining = remainingVal;
    globalThis.lastRateLimitReset = resetTime;

    if (remainingVal < 50) {
      console.warn(
        `GitHub API Rate limit is low: ${remainingVal} remaining. Resets at ${resetTime.toISOString()}`
      );
    }
  }

  return response;
}

/**
 * Enhanced fetch wrapper with automated retries and exponential backoff.
 * Retries on transient server errors (5xx) and rate limits (429).
 */
export async function fetchGitHubWithRetry(
  url: string,
  accessToken: string,
  options: GitHubFetchOptions = {},
  retries = 3,
  delay = 500
): Promise<Response> {
  let lastError: any;

  for (let i = 0; i < retries; i++) {
    try {
      // Pre-emptively wait if rate limit is exhausted
      if (
        globalThis.lastRateLimitRemaining !== undefined &&
        globalThis.lastRateLimitRemaining <= 2
      ) {
        const now = new Date();
        if (globalThis.lastRateLimitReset && globalThis.lastRateLimitReset > now) {
          const waitTime = globalThis.lastRateLimitReset.getTime() - now.getTime();
          // Only auto-wait if it resets in less than 30 seconds
          if (waitTime < 30000) {
            console.log(`Rate limit exhausted. Waiting ${waitTime}ms for reset...`);
            await new Promise((resolve) => setTimeout(resolve, waitTime));
          } else {
            throw new Error(
              `Rate limit exhausted. Next reset at ${globalThis.lastRateLimitReset.toISOString()}`
            );
          }
        }
      }

      const res = await fetchGitHub(url, accessToken, options);

      // Return immediately if successful
      if (res.ok) {
        return res;
      }

      // If rate limit (429) or server error (5xx), perform retry with exponential backoff
      if (res.status === 429 || res.status >= 500) {
        const backoffDelay = delay * Math.pow(2, i);
        console.warn(
          `Transient GitHub API issue (status ${res.status}) on ${url}. Retrying in ${backoffDelay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        continue;
      }

      // Non-retryable error (e.g. 400, 401, 403, 404), return response for handler to process
      return res;
    } catch (err: any) {
      lastError = err;
      const backoffDelay = delay * Math.pow(2, i);
      console.error(
        `Fetch attempt ${i + 1} failed for ${url}. Error: ${err.message}. Retrying in ${backoffDelay}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, backoffDelay));
    }
  }

  throw lastError || new Error(`Failed to fetch ${url} after ${retries} attempts.`);
}
