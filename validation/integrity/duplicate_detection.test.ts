import { TestResult, TEST_USER_ID, assertThrows } from "../utils";
import { db } from "@/lib/db";

export async function runDuplicateDetectionIntegrityTests(): Promise<TestResult[]> {
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

  await runTest("Repository unique githubId constraint", async () => {
    const data = {
      githubId: BigInt("8501"),
      name: "dup-repo",
      owner: "dup-owner",
      fullName: "dup-owner/dup-repo",
      htmlUrl: "https://github.com/dup-owner/dup-repo",
      userId: TEST_USER_ID,
      isTracked: true,
    };

    const repo1 = await db.repository.create({ data });

    try {
      await assertThrows(async () => {
        await db.repository.create({ data });
      }, "Should throw unique constraint error for duplicate repository githubId");
    } finally {
      await db.repository.delete({ where: { id: repo1.id } });
    }
  });

  await runTest("Commit unique sha constraint", async () => {
    const repo = await db.repository.create({
      data: {
        githubId: BigInt("8502"),
        name: "dup-commit-repo",
        owner: "dup-owner",
        fullName: "dup-owner/dup-commit-repo",
        htmlUrl: "https://github.com/dup-owner/dup-commit-repo",
        userId: TEST_USER_ID,
        isTracked: true,
      },
    });

    try {
      const data = {
        sha: "duplicate-commit-sha-val",
        message: "Commit msg",
        url: "url",
        committedAt: new Date(),
        repositoryId: repo.id,
        authorName: "Tester",
        authorEmail: "tester@test.com",
      };

      await db.commit.create({ data });

      await assertThrows(async () => {
        await db.commit.create({ data });
      }, "Should throw unique constraint error for duplicate commit sha");

    } finally {
      await db.repository.delete({ where: { id: repo.id } });
    }
  });

  await runTest("PullRequest unique githubId constraint", async () => {
    const repo = await db.repository.create({
      data: {
        githubId: BigInt("8503"),
        name: "dup-pr-repo",
        owner: "dup-owner",
        fullName: "dup-owner/dup-pr-repo",
        htmlUrl: "https://github.com/dup-owner/dup-pr-repo",
        userId: TEST_USER_ID,
        isTracked: true,
      },
    });

    try {
      const data = {
        githubId: BigInt("8601"),
        number: 1,
        title: "PR Title",
        state: "open",
        url: "url",
        createdAt: new Date(),
        updatedAt: new Date(),
        repositoryId: repo.id,
        authorName: "Tester",
        authorEmail: "tester@test.com",
      };

      await db.pullRequest.create({ data });

      await assertThrows(async () => {
        await db.pullRequest.create({ data });
      }, "Should throw unique constraint error for duplicate PR githubId");

    } finally {
      await db.repository.delete({ where: { id: repo.id } });
    }
  });

  return results;
}
