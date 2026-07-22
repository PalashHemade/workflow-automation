# Validation Suite — Integration-Project

* **Status:** 🔴 FAIL
* **Passed:** 0
* **Failed:** 1
* **Duration:** 0.00 seconds

## Test Cases Detailed Logs

| Test Name | Status | Duration | Error/Details |
|---|---|---|---|
| Project Integration: Create, List, and Delete Engineering Project | 🔴 FAIL | 3ms | ` Invalid `db.repository.create()` invocation in D:\github-tracker\validation\integration\project.test.ts:24:38    21 };   22    23 await runTest("Project Integration: Create, List, and Delete Engineering Project", async () => { → 24   const repo = await db.repository.create( Foreign key constraint violated: `Repository_userId_fkey (index)`` |
