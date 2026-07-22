import { TestResult, TEST_USER_ID, testFetchAuth, assert, assertEqual } from "../utils";
import { db } from "@/lib/db";

export async function runBigIntRegressionTests(): Promise<TestResult[]> {
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

  await runTest("GET /api/repos serializes Repository and Webhook BigInt fields as strings", async () => {
    // 1. Create a repository with a BigInt githubId and a Webhook with a BigInt githubWebhookId
    const repo = await db.repository.create({
      data: {
        githubId: BigInt("998877665544"), // Large BigInt value
        name: "bigint-repo",
        owner: "bigint-owner",
        fullName: "bigint-owner/bigint-repo",
        htmlUrl: "https://github.com/bigint-owner/bigint-repo",
        userId: TEST_USER_ID,
        isTracked: true,
        webhook: {
          create: {
            githubWebhookId: BigInt("1122334455"), // Large BigInt value
            status: "active",
            isActive: true,
          },
        },
      },
    });

    try {
      // 2. Fetch repos from API
      const res = await testFetchAuth("/api/repos");
      assertEqual(res.status, 200, "Should return 200 OK");
      
      const data = await res.json();
      const matched = data.dbRepos.find((r: any) => r.id === repo.id);
      
      assert(matched !== undefined, "Repo should be in dbRepos");
      assertEqual(typeof matched.githubId, "string", "Repository githubId should be serialized as a string");
      assertEqual(matched.githubId, "998877665544", "Repository githubId string value should match original BigInt");
      assertEqual(typeof matched.webhook.githubWebhookId, "string", "Webhook githubWebhookId should be serialized as a string");
      assertEqual(matched.webhook.githubWebhookId, "1122334455", "Webhook githubWebhookId value should match");

    } finally {
      await db.repository.delete({ where: { id: repo.id } });
    }
  });

  return results;
}
