import { TestResult, testFetchAuth, assert } from "../utils";
import { db } from "@/lib/db";

export async function runIncrementalSyncPerformanceTests(): Promise<TestResult[]> {
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

  await runTest("Incremental Sync with no changes is optimized (completes under 2.5s)", async () => {
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
      // 2. Run first sync to establish baseline
      await testFetchAuth("/api/repos/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryId: repoId }),
      });

      let isSuccess1 = false;
      const timeout1 = Date.now() + 30000;
      while (Date.now() < timeout1) {
        const repo = await db.repository.findUnique({ where: { id: repoId } });
        if (repo && repo.syncStatus === "success") {
          isSuccess1 = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      assert(isSuccess1, "First sync baseline must succeed");

      // 3. Trigger second sync immediately (no changes)
      const sync2StartTime = Date.now();
      await testFetchAuth("/api/repos/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryId: repoId }),
      });

      let isSuccess2 = false;
      const timeout2 = Date.now() + 30000;
      while (Date.now() < timeout2) {
        const repo = await db.repository.findUnique({ where: { id: repoId } });
        // Status resets to syncing, so we wait for it to become success again
        if (repo && repo.syncStatus === "success") {
          isSuccess2 = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const sync2Duration = Date.now() - sync2StartTime;
      assert(isSuccess2, "Second sync must succeed");
      assert(sync2Duration < 2500, `Incremental Sync was slow: ${sync2Duration}ms (expected < 2500ms)`);

    } finally {
      await db.repository.deleteMany({ where: { id: repoId } });
    }
  });

  return results;
}
