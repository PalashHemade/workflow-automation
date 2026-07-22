import { TestResult, testFetch, assertEqual } from "../utils";
import * as crypto from "crypto";

export async function runWebhookUnitTests(): Promise<TestResult[]> {
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

  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET || "MySecretWebhookToken123";
  const testPayload = JSON.stringify({ zen: "Keep it simple, stupid.", hook_id: 12345 });

  const computeSignature = (secret: string, payload: string) => {
    const hmac = crypto.createHmac("sha256", secret);
    return "sha256=" + hmac.update(payload).digest("hex");
  };

  await runTest("Valid webhook ping signature succeeds", async () => {
    const sig = computeSignature(webhookSecret, testPayload);

    const res = await testFetch("/api/webhooks/github", {
      method: "POST",
      headers: {
        "x-hub-signature-256": sig,
        "x-github-event": "ping",
        "Content-Type": "application/json",
      },
      body: testPayload,
    });

    // A valid ping event returns { message: "pong" } or similar status 200
    assertEqual(res.status, 200, "Should return 200 for valid ping signature");
    const data = await res.json();
    assertEqual(data.message, "pong", "Ping event should respond with pong");
  });

  await runTest("Missing signature returns 401", async () => {
    const res = await testFetch("/api/webhooks/github", {
      method: "POST",
      headers: {
        "x-github-event": "ping",
        "Content-Type": "application/json",
      },
      body: testPayload,
    });

    assertEqual(res.status, 401, "Should return 401 Unauthorized for missing signature");
  });

  await runTest("Invalid signature returns 401", async () => {
    const res = await testFetch("/api/webhooks/github", {
      method: "POST",
      headers: {
        "x-hub-signature-256": "sha256=invalidhashvalue1234567890abcdef",
        "x-github-event": "ping",
        "Content-Type": "application/json",
      },
      body: testPayload,
    });

    assertEqual(res.status, 401, "Should return 401 Unauthorized for invalid signature");
  });

  await runTest("Tampered signature returns 401", async () => {
    const badSecret = "WrongSecretWebhookToken";
    const sig = computeSignature(badSecret, testPayload);

    const res = await testFetch("/api/webhooks/github", {
      method: "POST",
      headers: {
        "x-hub-signature-256": sig,
        "x-github-event": "ping",
        "Content-Type": "application/json",
      },
      body: testPayload,
    });

    assertEqual(res.status, 401, "Should return 401 Unauthorized for tampered payload signature");
  });

  return results;
}
