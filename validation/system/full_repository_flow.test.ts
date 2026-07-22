import { TestResult, TEST_USER_ID, testFetch, testFetchAuth, assert, assertEqual } from "../utils";
import { db } from "@/lib/db";
import * as crypto from "crypto";

export async function runFullRepositorySystemTests(): Promise<TestResult[]> {
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

  await runTest("Complete E2E developer lifecycle and cascade deletion", async () => {
    const githubId = BigInt(998822);
    const repoOwner = "lifecycle-dev";
    const repoName = "lifecycle-project";

    // 1. Create the repository
    const repo = await db.repository.create({
      data: {
        githubId,
        name: repoName,
        owner: repoOwner,
        fullName: `${repoOwner}/${repoName}`,
        htmlUrl: `https://github.com/${repoOwner}/${repoName}`,
        userId: TEST_USER_ID,
        isTracked: true,
      },
    });

    const secret = process.env.GITHUB_WEBHOOK_SECRET || "MySecretWebhookToken123";

    const sendWebhook = async (event: string, payloadObj: any) => {
      const payloadStr = JSON.stringify(payloadObj);
      const hmac = crypto.createHmac("sha256", secret);
      const sig = "sha256=" + hmac.update(payloadStr).digest("hex");

      const res = await testFetch("/api/webhooks/github", {
        method: "POST",
        headers: {
          "x-hub-signature-256": sig,
          "x-github-event": event,
          "Content-Type": "application/json",
        },
        body: payloadStr,
      });
      assertEqual(res.status, 200, `Webhook '${event}' should succeed`);
    };

    try {
      // 2. Simulate branch creation (webhook)
      await sendWebhook("create", {
        ref_type: "branch",
        ref: "feature-branch",
        master_branch: "master-sha",
        repository: { id: Number(githubId) },
        sender: { login: "pusher-dev" },
      });

      // Verify branch created
      const dbBranch = await db.branch.findFirst({
        where: { repositoryId: repo.id, name: "feature-branch" },
      });
      assert(dbBranch !== null, "Branch should be created");

      // 3. Simulate PR Opened (webhook)
      const prGithubId = BigInt(112233);
      const prNumber = 10;
      await sendWebhook("pull_request", {
        action: "opened",
        number: prNumber,
        pull_request: {
          id: Number(prGithubId),
          number: prNumber,
          title: "Implement amazing feature",
          state: "open",
          html_url: "https://github.com/lifecycle-dev/lifecycle-project/pull/10",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          user: { login: "pusher-dev", id: 55501 },
          commits: 1,
          changed_files: 1,
        },
        repository: { id: Number(githubId) },
        sender: { login: "pusher-dev" },
      });

      const dbPR = await db.pullRequest.findFirst({
        where: { repositoryId: repo.id, number: prNumber },
      });
      assert(dbPR !== null, "PR should be created");
      assertEqual(dbPR!.state, "open", "PR state should be open");

      // 4. Simulate Pull Request Review (webhook)
      const reviewGithubId = BigInt(445566);
      await sendWebhook("pull_request_review", {
        action: "submitted",
        pull_request: {
          id: Number(prGithubId),
          number: prNumber,
        },
        review: {
          id: Number(reviewGithubId),
          user: { login: "reviewer-dev", id: 55502 },
          state: "approved",
          body: "LGTM!",
          submitted_at: new Date().toISOString(),
        },
        repository: { id: Number(githubId) },
      });

      const dbReview = await db.review.findFirst({
        where: { pullRequestId: dbPR!.id },
      });
      assert(dbReview !== null, "Review should be created");
      assertEqual(dbReview!.state.toUpperCase(), "APPROVED", "Review state should be APPROVED (case-insensitive check)");

      // 5. Simulate PR Merge (webhook)
      await sendWebhook("pull_request", {
        action: "closed",
        number: prNumber,
        pull_request: {
          id: Number(prGithubId),
          number: prNumber,
          title: "Implement amazing feature",
          state: "closed",
          html_url: "https://github.com/lifecycle-dev/lifecycle-project/pull/10",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          closed_at: new Date().toISOString(),
          merged_at: new Date().toISOString(),
          merged: true,
          user: { login: "pusher-dev", id: 55501 },
        },
        repository: { id: Number(githubId) },
        sender: { login: "pusher-dev" },
      });

      const dbPRMerged = await db.pullRequest.findUnique({
        where: { id: dbPR!.id },
      });
      assertEqual(dbPRMerged!.merged, true, "PR should be marked as merged");
      assertEqual(dbPRMerged!.state, "closed", "PR state should be closed");

      // 6. Simulate Branch Deletion (webhook)
      await sendWebhook("delete", {
        ref_type: "branch",
        ref: "feature-branch",
        repository: { id: Number(githubId) },
        sender: { login: "pusher-dev" },
      });

      const dbBranchDeleted = await db.branch.findFirst({
        where: { repositoryId: repo.id, name: "feature-branch" },
      });
      assert(dbBranchDeleted === null, "Branch should be removed from database");

      // 7. Verify Timeline Events ordering and metrics
      const timelineRes = await testFetchAuth(`/api/timeline?repositoryId=${repo.id}`);
      const timelineData = await timelineRes.json();
      assert(timelineData.events.length > 0, "Timeline events should exist");

      const metricsRes = await testFetchAuth(`/api/metrics?repositoryId=${repo.id}`);
      const metricsData = await metricsRes.json();
      assertEqual(metricsData.totalPrs, 1, "Metrics should count 1 PR");

    } finally {
      // 8. Delete repository via API and verify cascade deletion removes all children
      const deleteRes = await testFetchAuth(`/api/repos/${repo.id}`, {
        method: "DELETE",
      });
      assertEqual(deleteRes.status, 200, "DELETE API should return 200");

      const dbRepoDeleted = await db.repository.findUnique({ where: { id: repo.id } });
      assertEqual(dbRepoDeleted, null, "Repository should be deleted");

      const prDeleted = await db.pullRequest.findFirst({ where: { repositoryId: repo.id } });
      assertEqual(prDeleted, null, "PR should be cascade-deleted");

      const reviewsDeleted = await db.review.findFirst({ where: { pullRequest: { repositoryId: repo.id } } });
      assertEqual(reviewsDeleted, null, "Reviews should be cascade-deleted");
    }
  });

  return results;
}
