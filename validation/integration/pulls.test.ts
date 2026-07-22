import { TestResult, TEST_USER_ID, testFetchAuth, assert, assertEqual } from "../utils";
import { db } from "@/lib/db";

export async function runPullsIntegrationTests(): Promise<TestResult[]> {
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

  await runTest("GET /api/pulls returns filtered list by state", async () => {
    const repo = await db.repository.create({
      data: {
        githubId: BigInt("4010"),
        name: "pulls-repo",
        owner: "pulls-owner",
        fullName: "pulls-owner/pulls-repo",
        htmlUrl: "https://github.com/pulls-owner/pulls-repo",
        userId: TEST_USER_ID,
        isTracked: true,
      },
    });

    try {
      // 1. Seed 1 open and 1 merged PR
      await db.pullRequest.create({
        data: {
          githubId: BigInt("4101"),
          number: 101,
          title: "Open PR",
          state: "open",
          url: "url101",
          createdAt: new Date(),
          updatedAt: new Date(),
          merged: false,
          repositoryId: repo.id,
          authorName: "Tester",
          authorEmail: "tester@test.com",
        },
      });

      await db.pullRequest.create({
        data: {
          githubId: BigInt("4102"),
          number: 102,
          title: "Merged PR",
          state: "closed",
          url: "url102",
          createdAt: new Date(),
          updatedAt: new Date(),
          merged: true,
          mergedAt: new Date(),
          repositoryId: repo.id,
          authorName: "Tester",
          authorEmail: "tester@test.com",
        },
      });

      // 2. Fetch only merged PRs
      const res = await testFetchAuth(`/api/pulls?repositoryId=${repo.id}&state=merged`);
      assertEqual(res.status, 200, "Should return 200 OK");
      const data = await res.json();

      assertEqual(data.pulls.length, 1, "Should return exactly 1 pull request");
      assertEqual(data.pulls[0].number, 102, "The returned PR should be number 102 (merged)");

    } finally {
      await db.repository.delete({ where: { id: repo.id } });
    }
  });

  await runTest("GET /api/pulls/[number]/reviews returns reviews, files, and comments", async () => {
    const repo = await db.repository.create({
      data: {
        githubId: BigInt("4011"),
        name: "pulls-repo-2",
        owner: "pulls-owner",
        fullName: "pulls-owner/pulls-repo-2",
        htmlUrl: "https://github.com/pulls-owner/pulls-repo-2",
        userId: TEST_USER_ID,
        isTracked: true,
      },
    });

    try {
      const prNumber = 202;
      const pr = await db.pullRequest.create({
        data: {
          githubId: BigInt("4103"),
          number: prNumber,
          title: "PR with reviews",
          state: "open",
          url: "url202",
          createdAt: new Date(),
          updatedAt: new Date(),
          repositoryId: repo.id,
          authorName: "Tester",
          authorEmail: "tester@test.com",
        },
      });

      // Seed a file
      await db.pullRequestFile.create({
        data: {
          pullRequestId: pr.id,
          filename: "src/index.ts",
          status: "modified",
          additions: 5,
          deletions: 1,
          changes: 6,
        },
      });

      // Seed a review
      const review = await db.review.create({
        data: {
          githubId: BigInt("4201"),
          pullRequestId: pr.id,
          authorName: "Reviewer",
          state: "APPROVED",
          submittedAt: new Date(),
          body: "Great work!",
        },
      });

      // Seed a review comment on that review
      await db.reviewComment.create({
        data: {
          githubId: BigInt("4301"),
          pullRequestId: pr.id,
          reviewId: review.id,
          authorName: "Reviewer",
          path: "src/index.ts",
          line: 2,
          body: "Nit comment",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Hit API
      const res = await testFetchAuth(`/api/pulls/${prNumber}/reviews?repositoryId=${repo.id}`);
      assertEqual(res.status, 200, "Should return 200 OK");
      
      const data = await res.json();
      assert(data.pullRequest !== undefined, "Should return pullRequest details");
      assertEqual(data.pullRequest.files.length, 1, "Should contain 1 file");
      assertEqual(data.pullRequest.reviews.length, 1, "Should contain 1 review");
      assertEqual(data.pullRequest.reviews[0].comments.length, 1, "Review should contain 1 review comment");
      assertEqual(data.pullRequest.reviews[0].comments[0].body, "Nit comment", "Comment body should match");

    } finally {
      await db.repository.delete({ where: { id: repo.id } });
    }
  });

  return results;
}
