# Validation Suite — Unit-JiraSync

* **Status:** 🔴 FAIL
* **Passed:** 0
* **Failed:** 1
* **Duration:** 0.00 seconds

## Test Cases Detailed Logs

| Test Name | Status | Duration | Error/Details |
|---|---|---|---|
| Jira Sync: Creates SyncJob and Upserts Stories | 🔴 FAIL | 4ms | ` Invalid `db.repository.create()` invocation in D:\github-tracker\validation\unit\jira_sync.test.ts:25:38    22    23 await runTest("Jira Sync: Creates SyncJob and Upserts Stories", async () => {   24   // 1. Create test repo & project → 25   const repo = await db.repository.create( Foreign key constraint violated: `Repository_userId_fkey (index)`` |
