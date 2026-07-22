# Validation Suite — Security-OAuth

* **Status:** 🟢 PASS
* **Passed:** 6
* **Failed:** 0
* **Duration:** 0.10 seconds

## Test Cases Detailed Logs

| Test Name | Status | Duration | Error/Details |
|---|---|---|---|
| Route '/api/repos' blocks unauthorized requests with 401 | 🟢 PASS | 24ms | None |
| Route '/api/commits?repositoryId=dummy-id' blocks unauthorized requests with 401 | 🟢 PASS | 12ms | None |
| Route '/api/pulls?repositoryId=dummy-id' blocks unauthorized requests with 401 | 🟢 PASS | 13ms | None |
| Route '/api/timeline?repositoryId=dummy-id' blocks unauthorized requests with 401 | 🟢 PASS | 11ms | None |
| Route '/api/metrics?repositoryId=dummy-id' blocks unauthorized requests with 401 | 🟢 PASS | 11ms | None |
| Route '/api/analytics?repositoryId=dummy-id' blocks unauthorized requests with 401 | 🟢 PASS | 26ms | None |
