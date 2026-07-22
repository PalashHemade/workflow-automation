import { TestResult, TEST_USER_ID, testFetch, assert, assertEqual } from "../utils";
import { db } from "@/lib/db";
import * as crypto from "crypto";

export async function runWebhookLatencyPerformanceTests(): Promise<TestResult[]> {
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

  await runTest("Webhook endpoint response latency is fast (acknowledges under 500ms)", async () => {
    const githubId = BigInt(998833);
    const repo = await db.repository.create({
      data: {
        githubId,
        name: "latency-test-repo",
        owner: "webhook-dev",
        fullName: "webhook-dev/latency-test-repo",
        htmlUrl: "https://github.com/webhook-dev/latency-test-repo",
        userId: TEST_USER_ID,
        isTracked: true,
      },
    });

    try {
      const commitSha = "latency-flow-sha-123";
      const payloadObj = {
        ref: "refs/heads/main",
        before: "0000000000000000000000000000000000000000",
        after: commitSha,
        repository: {
          id: Number(githubId),
          name: "latency-test-repo",
          full_name: "webhook-dev/latency-test-repo",
          owner: { name: "webhook-dev" },
        },
        commits: [
          {
            id: commitSha,
            message: "Push from latency test",
            timestamp: new Date().toISOString(),
            url: `https://github.com/webhook-dev/latency-test-repo/commit/${commitSha}`,
            author: {
              name: "Latency Tester",
              email: "tester@latency.test",
              username: "latency-tester",
            },
          },
        ],
        sender: {
          login: "latency-tester",
          id: 77778,
          avatar_url: "https://github.com/images/sender.png",
        },
      };

      const payloadStr = JSON.stringify(payloadObj);
      const secret = process.env.GITHUB_WEBHOOK_SECRET || "MySecretWebhookToken123";
      
      const hmac = crypto.createHmac("sha256", secret);
      const sig = "sha256=" + hmac.update(payloadStr).digest("hex");

      const postStartTime = Date.now();

      // Post webhook event
      const res = await testFetch("/api/webhooks/github", {
        method: "POST",
        headers: {
          "x-hub-signature-256": sig,
          "x-github-event": "push",
          "Content-Type": "application/json",
        },
        body: payloadStr,
      });

      const latency = Date.now() - postStartTime;

      assertEqual(res.status, 200, "Webhook API should respond with 200 OK");
      assert(latency < 500, `Webhook endpoint response took too long: ${latency}ms (expected < 500ms)`);

    } finally {
      await db.repository.delete({ where: { id: repo.id } });
    }
  });

  return results;
}
