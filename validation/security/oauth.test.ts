import { TestResult, testFetch, assertEqual } from "../utils";

export async function runOAuthSecurityTests(): Promise<TestResult[]> {
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

  const routes = [
    "/api/repos",
    "/api/commits?repositoryId=dummy-id",
    "/api/pulls?repositoryId=dummy-id",
    "/api/timeline?repositoryId=dummy-id",
    "/api/metrics?repositoryId=dummy-id",
    "/api/analytics?repositoryId=dummy-id",
  ];

  for (const route of routes) {
    await runTest(`Route '${route}' blocks unauthorized requests with 401`, async () => {
      const res = await testFetch(route, { method: "GET" });
      assertEqual(res.status, 401, `Endpoint ${route} must require authentication`);
    });
  }

  return results;
}
