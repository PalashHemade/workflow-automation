# Validation Suite — Unit-Webhook

* **Status:** 🟢 PASS
* **Passed:** 4
* **Failed:** 0
* **Duration:** 0.28 seconds

## Test Cases Detailed Logs

| Test Name | Status | Duration | Error/Details |
|---|---|---|---|
| Valid webhook ping signature succeeds | 🟢 PASS | 240ms | None |
| Missing signature returns 401 | 🟢 PASS | 12ms | None |
| Invalid signature returns 401 | 🟢 PASS | 14ms | None |
| Tampered signature returns 401 | 🟢 PASS | 13ms | None |
