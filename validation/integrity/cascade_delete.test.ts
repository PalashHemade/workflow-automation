import { TestResult, TEST_USER_ID, assert, assertEqual } from "../utils";
import { db } from "@/lib/db";
import { EventEntityType, EventImportance, EventSource, ProcessingStatus } from "@prisma/client";

export async function runCascadeDeleteIntegrityTests(): Promise<TestResult[]> {
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

  await runTest("Deleting repository cascade-deletes all related entities", async () => {
    // 1. Create Repository
    const repo = await db.repository.create({
      data: {
        githubId: BigInt("8001"),
        name: "cascade-test-repo",
        owner: "cascade-owner",
        fullName: "cascade-owner/cascade-test-repo",
        htmlUrl: "https://github.com/cascade-owner/cascade-test-repo",
        userId: TEST_USER_ID,
        isTracked: true,
      },
    });

    const repoId = repo.id;

    // 2. Create Branch
    const branch = await db.branch.create({
      data: {
        repositoryId: repoId,
        name: "cascade-branch",
        sha: "branch-sha",
      },
    });

    // 3. Create Commit
    const commit = await db.commit.create({
      data: {
        sha: "cascade-commit-sha",
        message: "Commit msg",
        url: "url",
        committedAt: new Date(),
        repositoryId: repoId,
        authorName: "Tester",
        authorEmail: "tester@test.com",
      },
    });

    // 4. Create CommitFile
    const commitFile = await db.commitFile.create({
      data: {
        commitId: commit.id,
        filename: "src/file.ts",
        status: "added",
        additions: 1,
        deletions: 0,
        changes: 1,
      },
    });

    // 5. Create PullRequest
    const pr = await db.pullRequest.create({
      data: {
        githubId: BigInt("8101"),
        number: 1,
        title: "PR title",
        state: "open",
        url: "url",
        createdAt: new Date(),
        updatedAt: new Date(),
        repositoryId: repoId,
        authorName: "Tester",
        authorEmail: "tester@test.com",
      },
    });

    // 6. Create PullRequestFile
    const prFile = await db.pullRequestFile.create({
      data: {
        pullRequestId: pr.id,
        filename: "src/file.ts",
        status: "added",
        additions: 1,
        deletions: 0,
        changes: 1,
      },
    });

    // 7. Create Review
    const review = await db.review.create({
      data: {
        githubId: BigInt("8201"),
        pullRequestId: pr.id,
        authorName: "Reviewer",
        state: "APPROVED",
        submittedAt: new Date(),
      },
    });

    // 8. Create ReviewComment
    const comment = await db.reviewComment.create({
      data: {
        githubId: BigInt("8301"),
        pullRequestId: pr.id,
        reviewId: review.id,
        authorName: "Reviewer",
        path: "src/file.ts",
        line: 1,
        body: "Nit",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // 9. Create ProjectEvent
    const event = await db.projectEvent.create({
      data: {
        repositoryId: repoId,
        entityType: EventEntityType.COMMIT,
        entityId: commit.id,
        actorName: "Tester",
        title: "Pushed",
        importance: EventImportance.LOW,
        source: EventSource.SYNC,
        processingStatus: ProcessingStatus.COMPLETED,
        metadata: {},
      },
    });

    // 10. Create BackgroundSyncLog
    const syncLog = await db.backgroundSyncLog.create({
      data: {
        repositoryId: repoId,
        syncType: "manual",
        status: "completed",
      },
    });

    // 11. Create RepositoryWebhook
    const webhook = await db.repositoryWebhook.create({
      data: {
        repositoryId: repoId,
        githubWebhookId: BigInt("8401"),
        status: "active",
      },
    });

    // Assert they all exist first
    assertEqual(await db.branch.count({ where: { id: branch.id } }), 1, "Branch should exist");
    assertEqual(await db.commit.count({ where: { id: commit.id } }), 1, "Commit should exist");
    assertEqual(await db.commitFile.count({ where: { id: commitFile.id } }), 1, "CommitFile should exist");
    assertEqual(await db.pullRequest.count({ where: { id: pr.id } }), 1, "PR should exist");
    assertEqual(await db.pullRequestFile.count({ where: { id: prFile.id } }), 1, "PRFile should exist");
    assertEqual(await db.review.count({ where: { id: review.id } }), 1, "Review should exist");
    assertEqual(await db.reviewComment.count({ where: { id: comment.id } }), 1, "ReviewComment should exist");
    assertEqual(await db.projectEvent.count({ where: { id: event.id } }), 1, "ProjectEvent should exist");
    assertEqual(await db.backgroundSyncLog.count({ where: { id: syncLog.id } }), 1, "BackgroundSyncLog should exist");
    assertEqual(await db.repositoryWebhook.count({ where: { id: webhook.id } }), 1, "RepositoryWebhook should exist");

    // 12. Delete Repository
    await db.repository.delete({
      where: { id: repoId },
    });

    // Assert they are all cascade-deleted
    assertEqual(await db.branch.count({ where: { id: branch.id } }), 0, "Branch should be deleted");
    assertEqual(await db.commit.count({ where: { id: commit.id } }), 0, "Commit should be deleted");
    assertEqual(await db.commitFile.count({ where: { id: commitFile.id } }), 0, "CommitFile should be deleted");
    assertEqual(await db.pullRequest.count({ where: { id: pr.id } }), 0, "PR should be deleted");
    assertEqual(await db.pullRequestFile.count({ where: { id: prFile.id } }), 0, "PRFile should be deleted");
    assertEqual(await db.review.count({ where: { id: review.id } }), 0, "Review should be deleted");
    assertEqual(await db.reviewComment.count({ where: { id: comment.id } }), 0, "ReviewComment should be deleted");
    assertEqual(await db.projectEvent.count({ where: { id: event.id } }), 0, "ProjectEvent should be deleted");
    assertEqual(await db.backgroundSyncLog.count({ where: { id: syncLog.id } }), 0, "BackgroundSyncLog should be deleted");
    assertEqual(await db.repositoryWebhook.count({ where: { id: webhook.id } }), 0, "RepositoryWebhook should be deleted");
  });

  return results;
}
