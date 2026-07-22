import { TestResult, testFetch, assertEqual } from "../utils";

export async function runWebhookSignatureSecurityTests(): Promise<TestResult[]> {
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

  await runTest("Webhook rejects completely empty signature headers", async () => {
    const res = await testFetch("/api/webhooks/github", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "test" }),
    });
    assertEqual(res.status, 401, "Should block with 401 Unauthorized");
  });

  await runTest("Webhook rejects incorrect/fake signature headers", async () => {
    const res = await testFetch("/api/webhooks/github", {
      method: "POST",
      headers: {
        "x-hub-signature-256": "sha256=1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "test" }),
    });
    assertEqual(res.status, 401, "Should block with 401 Unauthorized");
  });

  return results;
}
