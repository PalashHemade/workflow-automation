import { TestResult, TEST_USER_ID, testFetchAuth, assertEqual } from "../utils";
import { db } from "@/lib/db";

export async function runLifecycleIntegrationTests(): Promise<TestResult[]> {
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

  await runTest("Archive repository settings update", async () => {
    const repo = await db.repository.create({
      data: {
        githubId: BigInt("4040"),
        name: "lifecycle-repo-1",
        owner: "lifecycle-owner",
        fullName: "lifecycle-owner/lifecycle-repo-1",
        htmlUrl: "https://github.com/lifecycle-owner/lifecycle-repo-1",
        userId: TEST_USER_ID,
        isTracked: true,
        isArchived: false,
      },
    });

    try {
      const res = await testFetchAuth(`/api/repos/${repo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: true }),
      });
      assertEqual(res.status, 200, "PATCH should return 200 OK");
      
      const dbRepo = await db.repository.findUnique({ where: { id: repo.id } });
      assertEqual(dbRepo?.isArchived, true, "Repository should be marked archived in database");
    } finally {
      await db.repository.delete({ where: { id: repo.id } });
    }
  });

  await runTest("Untrack repository settings update", async () => {
    const repo = await db.repository.create({
      data: {
        githubId: BigInt("4041"),
        name: "lifecycle-repo-2",
        owner: "lifecycle-owner",
        fullName: "lifecycle-owner/lifecycle-repo-2",
        htmlUrl: "https://github.com/lifecycle-owner/lifecycle-repo-2",
        userId: TEST_USER_ID,
        isTracked: true,
      },
    });

    try {
      const res = await testFetchAuth(`/api/repos/${repo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isTracked: false }),
      });
      assertEqual(res.status, 200, "PATCH should return 200 OK");
      
      const dbRepo = await db.repository.findUnique({ where: { id: repo.id } });
      assertEqual(dbRepo?.isTracked, false, "Repository tracking status should be disabled");
    } finally {
      await db.repository.delete({ where: { id: repo.id } });
    }
  });

  await runTest("Delete repository permanently removes DB entry", async () => {
    const repo = await db.repository.create({
      data: {
        githubId: BigInt("4042"),
        name: "lifecycle-repo-3",
        owner: "lifecycle-owner",
        fullName: "lifecycle-owner/lifecycle-repo-3",
        htmlUrl: "https://github.com/lifecycle-owner/lifecycle-repo-3",
        userId: TEST_USER_ID,
        isTracked: true,
      },
    });

    try {
      const res = await testFetchAuth(`/api/repos/${repo.id}`, {
        method: "DELETE",
      });
      assertEqual(res.status, 200, "DELETE /api/repos/:id should succeed with 200");
      
      const dbRepo = await db.repository.findUnique({ where: { id: repo.id } });
      assertEqual(dbRepo, null, "Repository should be permanently deleted from database");
    } catch (err) {
      // In case test failed, clean up manually
      await db.repository.deleteMany({ where: { id: repo.id } });
      throw err;
    }
  });

  return results;
}
