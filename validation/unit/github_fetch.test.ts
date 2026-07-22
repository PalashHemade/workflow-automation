import { TestResult, assertEqual, assertThrows } from "../utils";
import { fetchGitHubWithRetry } from "@/lib/github";

export async function runGithubFetchUnitTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  const runTest = async (name: string, fn: () => Promise<void>) => {
    const startTime = Date.now();
    try {
      await fn();
      results.push({ name, passed: true, durationMs: Date.now() - startTime });
    } catch (err: any) {
      results.push({
        name,
        passed: false,
        durationMs: Date.now() - startTime,
        error: err.message || String(err),
      });
    }
  };

  const originalFetch = globalThis.fetch;

  const restoreFetch = () => {
    globalThis.fetch = originalFetch;
  };

  await runTest("Retries on 500 internal server error and eventually succeeds", async () => {
    let callCount = 0;
    
    // @ts-ignore
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      callCount++;
      if (callCount < 3) {
        return new Response("Internal Server Error", {
          status: 500,
          headers: new Headers(),
        });
      }
      return new Response(JSON.stringify({ data: "success" }), {
        status: 200,
        headers: new Headers(),
      });
    };

    try {
      const res = await fetchGitHubWithRetry("https://api.github.com/test", "token", {}, 3, 10);
      assertEqual(res.status, 200, "Should eventually succeed with 200");
      assertEqual(callCount, 3, "Should have retried 3 times in total");
    } finally {
      restoreFetch();
    }
  });

  await runTest("Throws error after max retries fail", async () => {
    let callCount = 0;
    
    // @ts-ignore
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      callCount++;
      return new Response("Service Unavailable", {
        status: 503,
        headers: new Headers(),
      });
    };

    try {
      await assertThrows(async () => {
        await fetchGitHubWithRetry("https://api.github.com/test", "token", {}, 3, 5);
      }, "Should fail after max retries exceed");
      assertEqual(callCount, 3, "Should try exactly the max retries limit");
    } finally {
      restoreFetch();
    }
  });

  await runTest("Does not retry on non-retryable 404 error", async () => {
    let callCount = 0;

    // @ts-ignore
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      callCount++;
      return new Response("Not Found", {
        status: 404,
        headers: new Headers(),
      });
    };

    try {
      const res = await fetchGitHubWithRetry("https://api.github.com/test", "token", {}, 3, 5);
      assertEqual(res.status, 404, "Should return 404 immediately");
      assertEqual(callCount, 1, "Should not perform retries on non-retryable status codes");
    } finally {
      restoreFetch();
    }
  });

  return results;
}
