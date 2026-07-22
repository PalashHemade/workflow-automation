# Validation Suite — Unit-CorrelationEngine

* **Status:** 🔴 FAIL
* **Passed:** 1
* **Failed:** 1
* **Duration:** 0.00 seconds

## Test Cases Detailed Logs

| Test Name | Status | Duration | Error/Details |
|---|---|---|---|
| Correlation: Extract Multiple Jira Keys from text | 🟢 PASS | 0ms | None |
| Correlation: Links Commits & PRs to Stories in DB | 🔴 FAIL | 4ms | ` Invalid `db.repository.create()` invocation in D:\github-tracker\validation\unit\correlation_engine.test.ts:34:38    31    32 await runTest("Correlation: Links Commits & PRs to Stories in DB", async () => {   33   // Setup test repo & project → 34   const repo = await db.repository.create( Foreign key constraint violated: `Repository_userId_fkey (index)`` |
