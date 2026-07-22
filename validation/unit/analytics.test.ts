import { TestResult, TEST_USER_ID, testFetchAuth, assert, assertEqual } from "../utils";
import { db } from "@/lib/db";

export async function runAnalyticsUnitTests(): Promise<TestResult[]> {
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

  await runTest("Metrics API returns correct total counts and merge average", async () => {
    // 1. Setup temporary repository
    const repo = await db.repository.create({
      data: {
        githubId: BigInt("3001"),
        name: "analytics-test-repo",
        owner: "analytics-owner",
        fullName: "analytics-owner/analytics-test-repo",
        htmlUrl: "https://github.com/analytics-owner/analytics-test-repo",
        userId: TEST_USER_ID,
        isTracked: true,
        isArchived: false,
      },
    });

    try {
      // 2. Seed commits
      await db.commit.create({
        data: {
          sha: "sha-ana-1",
          message: "Commit 1",
          url: "url1",
          committedAt: new Date(),
          repositoryId: repo.id,
          authorName: "Author One",
          authorEmail: "one@test.com",
        },
      });

      // 3. Seed pull requests (one merged, one open)
      const prCreated = new Date(Date.now() - 4 * 60 * 60 * 1000); // 4 hours ago
      const prMerged = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago (duration = 2 hours)

      await db.pullRequest.create({
        data: {
          githubId: BigInt("3010"),
          number: 1,
          title: "PR One",
          state: "merged",
          url: "urlpr1",
          createdAt: prCreated,
          updatedAt: prMerged,
          merged: true,
          mergedAt: prMerged,
          repositoryId: repo.id,
          authorName: "Author One",
          authorEmail: "one@test.com",
        },
      });

      await db.pullRequest.create({
        data: {
          githubId: BigInt("3011"),
          number: 2,
          title: "PR Two",
          state: "open",
          url: "urlpr2",
          createdAt: new Date(),
          updatedAt: new Date(),
          merged: false,
          repositoryId: repo.id,
          authorName: "Author Two",
          authorEmail: "two@test.com",
        },
      });

      // 4. Hit metrics API
      const res = await testFetchAuth(`/api/metrics?repositoryId=${repo.id}`);
      assertEqual(res.status, 200, "Should load metrics");
      const metrics = await res.json();

      assertEqual(metrics.totalCommits, 1, "Total commits count should match");
      assertEqual(metrics.totalPrs, 2, "Total PRs count should match");
      assertEqual(metrics.openPrsCount, 1, "Open PRs count should match");
      assertEqual(metrics.averagePrMergeTimeHours, 2, "Average PR merge duration should be 2.0 hours");
    } finally {
      // Cleanup repo
      await db.repository.delete({
        where: { id: repo.id },
      });
    }
  });

  await runTest("Analytics API returns correct review cycle, approval rates, and file churn", async () => {
    const repo = await db.repository.create({
      data: {
        githubId: BigInt("3002"),
        name: "analytics-test-repo-2",
        owner: "analytics-owner",
        fullName: "analytics-owner/analytics-test-repo-2",
        htmlUrl: "https://github.com/analytics-owner/analytics-test-repo-2",
        userId: TEST_USER_ID,
        isTracked: true,
        isArchived: false,
      },
    });

    try {
      const prCreated = new Date(Date.now() - 5 * 60 * 60 * 1000); // 5 hours ago
      const reviewSubmitted = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago (cycle = 3 hours)

      // Create PR and Review
      const pr = await db.pullRequest.create({
        data: {
          githubId: BigInt("3020"),
          number: 1,
          title: "PR with Review",
          state: "open",
          url: "urlpr",
          createdAt: prCreated,
          updatedAt: reviewSubmitted,
          repositoryId: repo.id,
          authorName: "PR Author",
          authorEmail: "author@test.com",
        },
      });

      await db.review.create({
        data: {
          githubId: BigInt("3030"),
          pullRequestId: pr.id,
          authorName: "PR Reviewer",
          state: "APPROVED",
          submittedAt: reviewSubmitted,
        },
      });

      // Create Commit with files (Churn)
      const commit = await db.commit.create({
        data: {
          sha: "sha-churn-1",
          message: "Commit churn",
          url: "urlc",
          committedAt: new Date(),
          repositoryId: repo.id,
          authorName: "Dev",
          authorEmail: "dev@test.com",
        },
      });

      await db.commitFile.create({
        data: {
          commitId: commit.id,
          filename: "src/index.ts",
          status: "modified",
          additions: 20,
          deletions: 5,
          changes: 25,
        },
      });

      // Fetch analytics
      const res = await testFetchAuth(`/api/analytics?repositoryId=${repo.id}`);
      assertEqual(res.status, 200, "Should load analytics");
      const analytics = await res.json();

      assertEqual(analytics.avgReviewCycleHours, 3, "Review cycle duration should be 3 hours");
      assertEqual(analytics.approvalRate, 100, "Approval rate should be 100%");
      assertEqual(analytics.reviewsBreakdown.APPROVED, 1, "Approved count should be 1");
      
      // Churn
      assertEqual(analytics.fileChurn.length, 1, "Should show 1 churned file");
      assertEqual(analytics.fileChurn[0].filename, "index.ts", "File base name match");
      assertEqual(analytics.fileChurn[0].additions, 20, "File additions count match");
      assertEqual(analytics.fileChurn[0].deletions, 5, "File deletions count match");
      assertEqual(analytics.fileChurn[0].changes, 25, "File changes count match");

    } finally {
      await db.repository.delete({
        where: { id: repo.id },
      });
    }
  });

  return results;
}
