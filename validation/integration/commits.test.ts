import { TestResult, TEST_USER_ID, testFetchAuth, assert, assertEqual } from "../utils";
import { db } from "@/lib/db";

export async function runCommitsIntegrationTests(): Promise<TestResult[]> {
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

  await runTest("GET /api/commits returns paginated, sorted results with contributor", async () => {
    const repo = await db.repository.create({
      data: {
        githubId: BigInt("4001"),
        name: "commits-repo",
        owner: "commits-owner",
        fullName: "commits-owner/commits-repo",
        htmlUrl: "https://github.com/commits-owner/commits-repo",
        userId: TEST_USER_ID,
        isTracked: true,
      },
    });

    try {
      const contributor = await db.contributor.create({
        data: {
          githubId: BigInt("4444"),
          login: "commits-contributor",
          name: "Contributor Full Name",
        },
      });

      // Seed 3 commits
      await db.commit.create({
        data: {
          sha: "sha-int-1",
          message: "Commit 1",
          url: "url1",
          committedAt: new Date(Date.now() - 3000),
          repositoryId: repo.id,
          contributorId: contributor.id,
          authorName: "Contributor Full Name",
          authorEmail: "contrib@test.com",
        },
      });

      await db.commit.create({
        data: {
          sha: "sha-int-2",
          message: "Commit 2",
          url: "url2",
          committedAt: new Date(Date.now() - 2000),
          repositoryId: repo.id,
          contributorId: contributor.id,
          authorName: "Contributor Full Name",
          authorEmail: "contrib@test.com",
        },
      });

      await db.commit.create({
        data: {
          sha: "sha-int-3",
          message: "Commit 3",
          url: "url3",
          committedAt: new Date(Date.now() - 1000), // newest
          repositoryId: repo.id,
          contributorId: contributor.id,
          authorName: "Contributor Full Name",
          authorEmail: "contrib@test.com",
        },
      });

      // Hit API with pagination
      const res = await testFetchAuth(`/api/commits?repositoryId=${repo.id}&page=1&limit=2`);
      assertEqual(res.status, 200, "Should return 200 OK");
      const data = await res.json();

      assertEqual(data.commits.length, 2, "Should return 2 commits due to limit=2");
      assertEqual(data.pagination.total, 3, "Pagination total should be 3");
      assertEqual(data.pagination.pages, 2, "Pagination total pages should be 2");
      assertEqual(data.commits[0].sha, "sha-int-3", "Should be sorted newest first (sha-int-3 first)");
      assertEqual(data.commits[0].contributor.login, "commits-contributor", "Contributor should be joined");

    } finally {
      await db.repository.delete({ where: { id: repo.id } });
      await db.contributor.deleteMany({ where: { login: "commits-contributor" } });
    }
  });

  await runTest("GET /api/commits/[sha]/files lazy-loads from GitHub and caches in database", async () => {
    // 1. Create a repository linked to the actual octocat/Hello-World
    const repo = await db.repository.create({
      data: {
        githubId: BigInt("4002"),
        name: "Hello-World",
        owner: "octocat",
        fullName: "octocat/Hello-World",
        htmlUrl: "https://github.com/octocat/Hello-World",
        userId: TEST_USER_ID,
        isTracked: true,
      },
    });

    try {
      // Use a real commit SHA from octocat/Hello-World repository
      const sha = "7fd1a60b01f91b314f59955a4e4d4e80d8edf11d";
      const commit = await db.commit.create({
        data: {
          sha,
          message: "Merge pull request #6 from spaceghost/patch-1",
          url: `https://github.com/octocat/Hello-World/commit/${sha}`,
          committedAt: new Date("2012-03-06T23:06:50Z"),
          repositoryId: repo.id,
          authorName: "The Octocat",
          authorEmail: "octocat@github.com",
        },
      });

      // 2. First API fetch: should lazy load from GitHub
      const res1 = await testFetchAuth(`/api/commits/${sha}/files?repositoryId=${repo.id}`);
      assertEqual(res1.status, 200, "Should return 200 OK");
      const data1 = await res1.json();
      assertEqual(data1.source, "github", "First request should pull from GitHub API");
      assert(data1.files.length > 0, "Should contain files");

      // 3. Second API fetch: should read cached files from database
      const res2 = await testFetchAuth(`/api/commits/${sha}/files?repositoryId=${repo.id}`);
      assertEqual(res2.status, 200, "Should return 200 OK");
      const data2 = await res2.json();
      assertEqual(data2.source, "db", "Second request should pull cached files from DB");
      assertEqual(data2.files.length, data1.files.length, "Should contain the exact same number of files");

    } finally {
      await db.repository.delete({ where: { id: repo.id } });
    }
  });

  return results;
}
