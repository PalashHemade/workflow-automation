import { TestResult, testFetchAuth, assert, assertEqual } from "../utils";
import { db } from "@/lib/db";

export async function runHistoricalSyncPerformanceTests(): Promise<TestResult[]> {
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

  await runTest("Historical Sync performance benchmark (completes under 6s)", async () => {
    const owner = "PalashHemade";
    const name = "website-interview-scheduler";

    // 1. Post to track repo
    const postRes = await testFetchAuth("/api/repos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner, name }),
    });

    const postData = await postRes.json();
    const repoId = postData.repository.id;

    try {
      const syncStartTime = Date.now();

      // 2. Trigger sync
      await testFetchAuth("/api/repos/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryId: repoId }),
      });

      // 3. Poll DB up to 30s
      let isSuccess = false;
      const timeout = Date.now() + 30000;
      while (Date.now() < timeout) {
        const repo = await db.repository.findUnique({ where: { id: repoId } });
        if (repo && repo.syncStatus === "success") {
          isSuccess = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      const syncDuration = Date.now() - syncStartTime;
      assert(isSuccess, "Sync must complete successfully");
      assert(syncDuration < 6000, `Historical Sync took too long: ${syncDuration}ms (expected < 6000ms)`);

    } finally {
      await db.repository.deleteMany({ where: { id: repoId } });
    }
  });

  return results;
}
