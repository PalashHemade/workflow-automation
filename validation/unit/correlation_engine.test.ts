import { TestResult, assert, assertEqual, TEST_USER_ID } from "../utils";
import { db } from "@/lib/db";
import { extractJiraIssueKeys, correlateProject } from "@/lib/correlationEngine";

export async function runCorrelationEngineUnitTests(): Promise<TestResult[]> {
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

  await runTest("Correlation: Extract Multiple Jira Keys from text", async () => {
    const text = "feat(AUTH-101): add login module and resolve PAY-202 and BUG-99";
    const keys = extractJiraIssueKeys(text);
    assertEqual(keys.length, 3, "Should extract 3 unique keys");
    assert(keys.includes("AUTH-101"), "Should include AUTH-101");
    assert(keys.includes("PAY-202"), "Should include PAY-202");
    assert(keys.includes("BUG-99"), "Should include BUG-99");
  });

  await runTest("Correlation: Links Commits & PRs to Stories in DB", async () => {
    // Setup test repo & project
    const repo = await db.repository.create({
      data: {
        githubId: BigInt(88882222),
        name: "test-corr-repo",
        owner: "testowner",
        fullName: "testowner/test-corr-repo",
        htmlUrl: "https://github.com/testowner/test-corr-repo",
        userId: TEST_USER_ID,
      },
    });

    const project = await db.engineeringProject.create({
      data: {
        name: "Test Correlation Project",
        ownerId: TEST_USER_ID,
        repositoryId: repo.id,
      },
    });

    const story = await db.story.create({
      data: {
        jiraId: "story-101",
        key: "AUTH-101",
        summary: "Implement Login OAuth",
        status: "In Progress",
        projectId: project.id,
      },
    });

    const commit = await db.commit.create({
      data: {
        sha: "abc123sha789",
        message: "feat(AUTH-101): implement OAuth flow",
        url: "https://github.com/test/repo/commit/abc123sha789",
        committedAt: new Date(),
        repositoryId: repo.id,
        authorName: "Developer",
        authorEmail: "dev@gitinsight.test",
      },
    });

    // Run correlation
    const corrRes = await correlateProject(project.id);
    assert(corrRes.correlatedCommits >= 1, "Should correlate commit to story");

    // Check StoryCommit record created
    const sc = await db.storyCommit.findFirst({
      where: { storyId: story.id, commitId: commit.id },
    });
    assert(sc !== null, "StoryCommit record should exist");
    assertEqual(sc?.matchedBy, "COMMIT", "Matched by should be COMMIT");

    // Cleanup
    await db.engineeringProject.delete({ where: { id: project.id } });
    await db.repository.delete({ where: { id: repo.id } });
  });

  return results;
}
