import { TestResult, TEST_USER_ID, testFetchAuth, assert, assertEqual } from "../utils";
import { db } from "@/lib/db";

export async function runMetricsIntegrationTests(): Promise<TestResult[]> {
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

  await runTest("GET /api/metrics schema contract checks", async () => {
    const repo = await db.repository.create({
      data: {
        githubId: BigInt("4030"),
        name: "metrics-contract-repo",
        owner: "metrics-owner",
        fullName: "metrics-owner/metrics-contract-repo",
        htmlUrl: "https://github.com/metrics-owner/metrics-contract-repo",
        userId: TEST_USER_ID,
        isTracked: true,
      },
    });

    try {
      const res = await testFetchAuth(`/api/metrics?repositoryId=${repo.id}`);
      assertEqual(res.status, 200, "Should return 200 OK");
      const data = await res.json();

      const requiredKeys = [
        "repositoryName",
        "fullName",
        "webhookEnabled",
        "isArchived",
        "syncStatus",
        "totalCommits",
        "totalPrs",
        "openPrsCount",
        "averagePrMergeTimeHours",
        "commitFrequency",
        "topContributors",
      ];

      for (const key of requiredKeys) {
        assert(data[key] !== undefined, `Response payload should contain required field: '${key}'`);
      }

      assertEqual(typeof data.totalCommits, "number", "totalCommits should be a number");
      assertEqual(Array.isArray(data.commitFrequency), true, "commitFrequency should be an array");
      assertEqual(Array.isArray(data.topContributors), true, "topContributors should be an array");

    } finally {
      await db.repository.delete({ where: { id: repo.id } });
    }
  });

  await runTest("GET /api/analytics schema contract checks", async () => {
    const repo = await db.repository.create({
      data: {
        githubId: BigInt("4031"),
        name: "analytics-contract-repo",
        owner: "metrics-owner",
        fullName: "metrics-owner/analytics-contract-repo",
        htmlUrl: "https://github.com/metrics-owner/analytics-contract-repo",
        userId: TEST_USER_ID,
        isTracked: true,
      },
    });

    try {
      const res = await testFetchAuth(`/api/analytics?repositoryId=${repo.id}`);
      assertEqual(res.status, 200, "Should return 200 OK");
      const data = await res.json();

      const requiredKeys = [
        "avgReviewCycleHours",
        "approvalRate",
        "reviewsBreakdown",
        "fileChurn",
        "weeklyChurn",
        "prStateSummary",
      ];

      for (const key of requiredKeys) {
        assert(data[key] !== undefined, `Response payload should contain required field: '${key}'`);
      }

      assertEqual(typeof data.avgReviewCycleHours, "number", "avgReviewCycleHours should be a number");
      assertEqual(typeof data.approvalRate, "number", "approvalRate should be a number");
      assertEqual(Array.isArray(data.fileChurn), true, "fileChurn should be an array");
      assertEqual(Array.isArray(data.weeklyChurn), true, "weeklyChurn should be an array");
      assertEqual(typeof data.prStateSummary, "object", "prStateSummary should be an object");

    } finally {
      await db.repository.delete({ where: { id: repo.id } });
    }
  });

  return results;
}
