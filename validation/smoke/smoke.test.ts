import { TestResult, testFetch, testFetchAuth, assertEqual } from "../utils";

export async function runSmokeTests(): Promise<TestResult[]> {
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

  // 1. Application reachable
  await runTest("Reachable: Home Page", async () => {
    const res = await testFetch("/");
    assertEqual(res.status, 200, "Home page should load with HTTP 200");
  });

  // 2. Authentication guard (unauthorized check)
  await runTest("Auth Guard: GET /api/repos without session", async () => {
    const res = await testFetch("/api/repos");
    assertEqual(res.status, 401, "Should return 401 Unauthorized");
  });

  // 3. Repository endpoint reachable with session
  await runTest("Reachable: GET /api/repos with session", async () => {
    const res = await testFetchAuth("/api/repos");
    assertEqual(res.status, 200, "Should return 200 OK");
    const data = await res.json();
    assertEqual(Array.isArray(data.dbRepos), true, "dbRepos should be an array");
  });

  // 4. Commits endpoint reachability and input check
  await runTest("Reachable: GET /api/commits requires repositoryId", async () => {
    const res = await testFetchAuth("/api/commits");
    assertEqual(res.status, 400, "Should return 400 Bad Request when repositoryId is missing");
  });

  // 5. Timeline endpoint reachability and input check
  await runTest("Reachable: GET /api/timeline requires repositoryId", async () => {
    const res = await testFetchAuth("/api/timeline");
    assertEqual(res.status, 400, "Should return 400 Bad Request when repositoryId is missing");
  });

  // 6. Metrics endpoint reachability and input check
  await runTest("Reachable: GET /api/metrics requires repositoryId", async () => {
    const res = await testFetchAuth("/api/metrics");
    assertEqual(res.status, 400, "Should return 400 Bad Request when repositoryId is missing");
  });

  return results;
}
