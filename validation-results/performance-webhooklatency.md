# Validation Suite — Performance-WebhookLatency

* **Status:** 🔴 FAIL
* **Passed:** 0
* **Failed:** 1
* **Duration:** 0.01 seconds

## Test Cases Detailed Logs

| Test Name | Status | Duration | Error/Details |
|---|---|---|---|
| Webhook endpoint response latency is fast (acknowledges under 500ms) | 🔴 FAIL | 5ms | ` Invalid `db.repository.create()` invocation in D:\github-tracker\validation\performance\webhook_latency.test.ts:25:38    22    23 await runTest("Webhook endpoint response latency is fast (acknowledges under 500ms)", async () => {   24   const githubId = BigInt(998833); → 25   const repo = await db.repository.create( Foreign key constraint violated: `Repository_userId_fkey (index)`` |
