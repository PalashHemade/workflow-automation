import { TestResult, testFetchAuth, assert, assertEqual } from "../utils";
import { db } from "@/lib/db";

export async function runOnboardingSystemTests(): Promise<TestResult[]> {
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

  await runTest("Complete onboarding: Track website-interview-scheduler and verify sync starts", async () => {
    const owner = "PalashHemade";
    const name = "website-interview-scheduler";

    // 1. Post to track repo
    const postRes = await testFetchAuth("/api/repos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner, name }),
    });

    assertEqual(postRes.status, 200, "Should successfully register the repo");
    const postData = await postRes.json();
    const repoId = postData.repository.id;

    try {
      // 2. Trigger sync manually via API
      const syncRes = await testFetchAuth("/api/repos/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryId: repoId }),
      });

      assertEqual(syncRes.status, 200, "Should start sync in the background");

      // 3. Poll DB up to 30 seconds to verify sync status transitions to success
      let isSynced = false;
      const timeout = Date.now() + 30000; // 30 seconds timeout (it should finish in 2-3 seconds now!)

      while (Date.now() < timeout) {
        const repo = await db.repository.findUnique({
          where: { id: repoId },
        });

        if (repo && (repo.syncStatus === "success" || repo.syncStatus === "failed")) {
          assertEqual(repo.syncStatus, "success", `Sync status should be success (got ${repo.syncStatus}. Error: ${repo.lastSyncError})`);
          isSynced = true;
          break;
        }

        // Wait 250ms
        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      assert(isSynced, "Sync status should change to success within timeout");

      // 4. Verify entities populated
      const commitsCount = await db.commit.count({ where: { repositoryId: repoId } });
      assert(commitsCount > 0, "Should have imported historical commits");

      const prsCount = await db.pullRequest.count({ where: { repositoryId: repoId } });
      assert(prsCount >= 0, "Should successfully query pull requests");

      const branchCount = await db.branch.count({ where: { repositoryId: repoId } });
      assert(branchCount > 0, "Should have imported branches");

    } finally {
      // Cleanup
      await db.repository.deleteMany({ where: { id: repoId } });
    }
  });

  return results;
}
