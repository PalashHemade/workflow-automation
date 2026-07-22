import { TestResult, TEST_USER_ID, assert, assertEqual } from "../utils";
import { runIncrementalSync } from "@/lib/syncEngine";
import { db } from "@/lib/db";

export async function runSyncEngineUnitTests(): Promise<TestResult[]> {
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

  await runTest("Sync Engine imports commits and updates lastSuccessfulCommitSha", async () => {
    // 1. Create a temporary repository
    const repo = await db.repository.create({
      data: {
        githubId: BigInt("2001"),
        name: "sync-test-repo",
        owner: "sync-owner",
        fullName: "sync-owner/sync-test-repo",
        htmlUrl: "https://github.com/sync-owner/sync-test-repo",
        userId: TEST_USER_ID,
        isTracked: true,
        isArchived: false,
        webhookEnabled: false,
        syncStatus: "idle",
      },
    });

    const commitSha = "mock-new-sha-abc-123";

    // 2. Setup mock fetch
    // @ts-ignore
    globalThis.fetch = async (url: string | URL, options?: RequestInit) => {
      const urlStr = typeof url === "string" ? url : url.toString();

      if (urlStr.includes("/commits?")) {
        // Return 1 mock commit
        return new Response(
          JSON.stringify([
            {
              sha: commitSha,
              html_url: `https://github.com/sync-owner/sync-test-repo/commit/${commitSha}`,
              commit: {
                message: "Validation Test Commit Message\nDetails here",
                author: {
                  name: "Sync Tester",
                  email: "tester@sync.test",
                  date: new Date().toISOString(),
                },
              },
              author: {
                login: "sync-tester-login",
                id: 991122,
                avatar_url: "https://github.com/images/tester.png",
              },
            },
          ]),
          { status: 200, headers: new Headers() }
        );
      }

      if (urlStr.includes("/pulls?")) {
        // Return empty array (no PRs)
        return new Response(JSON.stringify([]), { status: 200, headers: new Headers() });
      }

      if (urlStr.includes("/branches?")) {
        // Return 1 main branch
        return new Response(
          JSON.stringify([
            {
              name: "main",
              commit: { sha: commitSha },
              protected: false,
            },
          ]),
          { status: 200, headers: new Headers() }
        );
      }

      if (urlStr.endsWith("/sync-test-repo")) {
        // Repository metadata
        return new Response(
          JSON.stringify({
            default_branch: "main",
          }),
          { status: 200, headers: new Headers() }
        );
      }

      // Default fallback
      return new Response(JSON.stringify({}), { status: 200, headers: new Headers() });
    };

    try {
      // 3. Run incremental sync
      const syncResult = await runIncrementalSync(repo.id, "manual", 1);
      
      assertEqual(syncResult.commitsSynced, 1, "Should have synced exactly 1 commit");
      assertEqual(syncResult.prsSynced, 0, "Should have synced 0 pull requests");

      // Verify DB updates
      const updatedRepo = await db.repository.findUnique({
        where: { id: repo.id },
      });

      assert(updatedRepo !== null, "Repo should exist in DB");
      assertEqual(updatedRepo!.syncStatus, "success", "Sync status should be success");
      assertEqual(updatedRepo!.lastSuccessfulCommitSha, commitSha, "Last commit SHA should be updated");

      const savedCommit = await db.commit.findUnique({
        where: { sha: commitSha },
      });
      assert(savedCommit !== null, "Commit record should be saved in database");
      assertEqual(savedCommit!.message, "Validation Test Commit Message\nDetails here", "Message should match");

    } finally {
      restoreFetch();
      // Cleanup repository (will cascade delete branches and commits!)
      await db.repository.delete({
        where: { id: repo.id },
      });
    }
  });

  return results;
}
