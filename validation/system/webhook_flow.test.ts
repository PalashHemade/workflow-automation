import { TestResult, TEST_USER_ID, testFetch, assert, assertEqual } from "../utils";
import { db } from "@/lib/db";
import * as crypto from "crypto";
import { EventEntityType } from "@prisma/client";

export async function runWebhookSystemTests(): Promise<TestResult[]> {
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

  await runTest("Webhook Ingestion Flow: Push event inserts commit and timeline event", async () => {
    // 1. Create a tracked repository in the DB
    const githubId = BigInt(998811);
    const repo = await db.repository.create({
      data: {
        githubId,
        name: "webhook-test-repo",
        owner: "webhook-owner",
        fullName: "webhook-owner/webhook-test-repo",
        htmlUrl: "https://github.com/webhook-owner/webhook-test-repo",
        userId: TEST_USER_ID,
        isTracked: true,
      },
    });

    try {
      const commitSha = "whsha998877665544332211";
      const payload = {
        repository: {
          id: 998811,
          name: "webhook-test-repo",
          full_name: "webhook-owner/webhook-test-repo",
          html_url: "https://github.com/webhook-owner/webhook-test-repo",
        },
        pusher: {
          name: "Webhook Tester",
          email: "webhook@test.com",
        },
        head_commit: {
          id: commitSha,
          message: "Push from webhook flow test",
          url: `https://github.com/webhook-owner/webhook-test-repo/commit/${commitSha}`,
          timestamp: new Date().toISOString(),
          author: {
            name: "Webhook Tester",
            email: "webhook@test.com",
            username: "webhooktester",
          },
          added: ["file1.txt"],
          removed: [],
          modified: [],
        },
      };

      const payloadStr = JSON.stringify(payload);
      const secret = process.env.GITHUB_WEBHOOK_SECRET || "MySecretWebhookToken123";
      const hmac = crypto.createHmac("sha256", secret);
      const signature = "sha256=" + hmac.update(payloadStr).digest("hex");

      // 2. Dispatch push webhook to endpoint
      const res = await testFetch("/api/webhooks/github", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-github-event": "push",
          "x-hub-signature-256": signature,
        },
        body: payloadStr,
      });

      assertEqual(res.status, 200, "Webhook endpoint should return 200 OK");
      const data = await res.json();
      assert(data.success, "Payload should indicate success");

      // 3. Verify commit is inserted in the DB
      const dbCommit = await db.commit.findUnique({
        where: { sha: commitSha },
      });
      assert(dbCommit !== null, "Commit should be saved in DB");
      assertEqual(dbCommit!.message, "Push from webhook flow test", "Commit message should match");

      // 4. Verify ProjectEvent is generated in the timeline
      const dbEvent = await db.projectEvent.findFirst({
        where: {
          repositoryId: repo.id,
          entityType: EventEntityType.COMMIT,
          entityId: dbCommit!.id,
        },
      });
      assert(dbEvent !== null, "ProjectEvent for COMMIT should be generated");
      assertEqual(dbEvent!.actorName, "Webhook Tester", "Actor name should be the pusher");

    } finally {
      await db.repository.delete({ where: { id: repo.id } });
    }
  });

  return results;
}
