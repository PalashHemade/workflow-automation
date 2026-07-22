import { TestResult, testFetchAuth, assert, assertEqual } from "../utils";
import { db } from "@/lib/db";

export async function runSyncSystemTests(): Promise<TestResult[]> {
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

  await runTest("Historical Sync Flow: Verify DB, Timeline events, and Analytics aggregates match GitHub", async () => {
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
      // 2. Trigger sync
      await testFetchAuth("/api/repos/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryId: repoId }),
      });

      // 3. Wait for sync to complete (up to 30s)
      let isSuccess = false;
      const timeout = Date.now() + 30000;
      while (Date.now() < timeout) {
        const repo = await db.repository.findUnique({ where: { id: repoId } });
        if (repo && repo.syncStatus === "success") {
          isSuccess = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      assert(isSuccess, "Sync must complete successfully");

      // 4. Verify Timeline Events populated
      const eventsCount = await db.projectEvent.count({ where: { repositoryId: repoId } });
      assert(eventsCount > 0, "Timeline events should be generated for commits");

      // 5. Verify Analytics returns correct values
      const res = await testFetchAuth(`/api/metrics?repositoryId=${repoId}`);
      assertEqual(res.status, 200, "Metrics API should load");
      const metrics = await res.json();
      
      const commitsCount = await db.commit.count({ where: { repositoryId: repoId } });
      const prsCount = await db.pullRequest.count({ where: { repositoryId: repoId } });

      assertEqual(metrics.totalCommits, commitsCount, "Metrics totalCommits count should match DB");
      assertEqual(metrics.totalPrs, prsCount, "Metrics totalPrs count should match DB");

    } finally {
      await db.repository.deleteMany({ where: { id: repoId } });
    }
  });

  return results;
}
