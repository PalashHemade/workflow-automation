import { TestResult, testFetchAuth, assert, assertEqual } from "../utils";
import { db } from "@/lib/db";

export async function runRepositoryIntegrationTests(): Promise<TestResult[]> {
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

  await runTest("Track repository (POST /api/repos), list (GET /api/repos), and edit (PATCH /api/repos/[id])", async () => {
    const repoName = "Hello-World";
    const repoOwner = "octocat";

    let repoId = "";
    try {
      // 1. Track new repository (POST)
      const postRes = await testFetchAuth("/api/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: repoOwner, name: repoName }),
      });

      assertEqual(postRes.status, 200, "POST /api/repos should succeed with 200");
      const postData = await postRes.json();
      assert(postData.success, "Should indicate success in payload");
      assert(postData.repository?.id !== undefined, "Should return repository details with database ID");
      repoId = postData.repository.id;

      // 2. List tracked repos (GET /api/repos)
      const getRes = await testFetchAuth("/api/repos");
      assertEqual(getRes.status, 200, "GET /api/repos should succeed");
      const getData = await getRes.json();
      const matched = getData.dbRepos.find((r: any) => r.id === repoId);
      assert(matched !== undefined, "Tracked repo should be present in returned dbRepos list");

      // 3. Update repo settings (PATCH /api/repos/[id])
      const patchRes = await testFetchAuth(`/api/repos/${repoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: "Test Custom Display Name", isArchived: true }),
      });

      assertEqual(patchRes.status, 200, "PATCH should return 200");
      const patchData = await patchRes.json();
      assertEqual(patchData.repository.displayName, "Test Custom Display Name", "DisplayName should match updated value");
      assertEqual(patchData.repository.isArchived, true, "isArchived should be true");

    } finally {
      if (repoId) {
        // Cleanup repo
        await db.repository.deleteMany({
          where: { id: repoId },
        });
      }
    }
  });

  return results;
}
