import { TestResult, TEST_USER_ID, testFetchAuth, assertEqual } from "../utils";
import { db } from "@/lib/db";

export async function runAuthorizationSecurityTests(): Promise<TestResult[]> {
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

  await runTest("User A cannot access or modify User B's repository (403 Forbidden)", async () => {
    // 1. Create User B
    const userB = await db.user.create({
      data: {
        id: "val-user-b-id",
        email: "userb@gitinsight.test",
        name: "Validation User B",
      },
    });

    // 2. Create Repository owned by User B
    const repoB = await db.repository.create({
      data: {
        githubId: BigInt("4999"),
        name: "userb-private-repo",
        owner: "userb",
        fullName: "userb/userb-private-repo",
        htmlUrl: "https://github.com/userb/userb-private-repo",
        userId: userB.id,
        isTracked: true,
      },
    });

    try {
      // 3. Attempt to fetch User B's metrics using User A's credentials
      const getMetricsRes = await testFetchAuth(`/api/metrics?repositoryId=${repoB.id}`);
      assertEqual(getMetricsRes.status, 403, "GET /api/metrics for another user's repo must return 403");

      // 4. Attempt to update User B's settings using User A's credentials
      const patchSettingsRes = await testFetchAuth(`/api/repos/${repoB.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: true }),
      });
      assertEqual(patchSettingsRes.status, 403, "PATCH /api/repos/:id for another user's repo must return 403");

      // 5. Attempt to delete User B's repository using User A's credentials
      const deleteRes = await testFetchAuth(`/api/repos/${repoB.id}`, {
        method: "DELETE",
      });
      assertEqual(deleteRes.status, 403, "DELETE /api/repos/:id for another user's repo must return 403");

    } finally {
      // Clean up User B's repository and User B
      await db.repository.deleteMany({ where: { id: repoB.id } });
      await db.user.delete({ where: { id: userB.id } });
    }
  });

  return results;
}
