import { TestResult, TEST_USER_ID, assert, assertEqual } from "../utils";
import { db } from "@/lib/db";

export async function runSchedulerUnitTests(): Promise<TestResult[]> {
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

  await runTest("Scheduler selects only eligible repositories", async () => {
    const timeNow = new Date();

    // 1. Create a set of repositories with different flags
    const repoEligible = await db.repository.create({
      data: {
        githubId: BigInt("1001"),
        name: "eligible-repo",
        owner: "scheduler-test",
        fullName: "scheduler-test/eligible-repo",
        htmlUrl: "https://github.com/scheduler-test/eligible-repo",
        userId: TEST_USER_ID,
        isTracked: true,
        isArchived: false,
        webhookEnabled: false,
        nextAllowedSyncAt: null,
      },
    });

    const repoUntracked = await db.repository.create({
      data: {
        githubId: BigInt("1002"),
        name: "untracked-repo",
        owner: "scheduler-test",
        fullName: "scheduler-test/untracked-repo",
        htmlUrl: "https://github.com/scheduler-test/untracked-repo",
        userId: TEST_USER_ID,
        isTracked: false, // NOT TRACKED
        isArchived: false,
        webhookEnabled: false,
        nextAllowedSyncAt: null,
      },
    });

    const repoArchived = await db.repository.create({
      data: {
        githubId: BigInt("1003"),
        name: "archived-repo",
        owner: "scheduler-test",
        fullName: "scheduler-test/archived-repo",
        htmlUrl: "https://github.com/scheduler-test/archived-repo",
        userId: TEST_USER_ID,
        isTracked: true,
        isArchived: true, // ARCHIVED
        webhookEnabled: false,
        nextAllowedSyncAt: null,
      },
    });

    const repoWebhookEnabled = await db.repository.create({
      data: {
        githubId: BigInt("1004"),
        name: "webhook-enabled-repo",
        owner: "scheduler-test",
        fullName: "scheduler-test/webhook-enabled-repo",
        htmlUrl: "https://github.com/scheduler-test/webhook-enabled-repo",
        userId: TEST_USER_ID,
        isTracked: true,
        isArchived: false,
        webhookEnabled: true, // WEBHOOK ACTIVE
        nextAllowedSyncAt: null,
      },
    });

    const repoCooldown = await db.repository.create({
      data: {
        githubId: BigInt("1005"),
        name: "cooldown-repo",
        owner: "scheduler-test",
        fullName: "scheduler-test/cooldown-repo",
        htmlUrl: "https://github.com/scheduler-test/cooldown-repo",
        userId: TEST_USER_ID,
        isTracked: true,
        isArchived: false,
        webhookEnabled: false,
        nextAllowedSyncAt: new Date(timeNow.getTime() + 60 * 60 * 1000), // COOLDOWN 1 HOUR
      },
    });

    try {
      // Execute the query used in src/lib/scheduler.ts
      const eligibleRepos = await db.repository.findMany({
        where: {
          isTracked: true,
          isArchived: false,
          webhookEnabled: false,
          OR: [
            { nextAllowedSyncAt: null },
            { nextAllowedSyncAt: { lte: timeNow } },
          ],
        },
      });

      // Filter our specific created test repos
      const testIds = new Set([
        repoEligible.id,
        repoUntracked.id,
        repoArchived.id,
        repoWebhookEnabled.id,
        repoCooldown.id,
      ]);
      const matchedRepos = eligibleRepos.filter((r) => testIds.has(r.id));

      assertEqual(matchedRepos.length, 1, "Only 1 repository should be selected");
      assertEqual(matchedRepos[0].id, repoEligible.id, "The selected repository must be the eligible one");
    } finally {
      // Cleanup all created repos
      await db.repository.deleteMany({
        where: {
          id: {
            in: [
              repoEligible.id,
              repoUntracked.id,
              repoArchived.id,
              repoWebhookEnabled.id,
              repoCooldown.id,
            ],
          },
        },
      });
    }
  });

  return results;
}
