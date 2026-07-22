import * as fs from "fs";
import * as path from "path";
import { TestSuiteResult } from "../utils";
import { metricsCollector } from "../metrics/metricsCollector";

export function generateReport(results: TestSuiteResult[], totalDurationMs: number) {
  const outputDir = path.join(process.cwd(), "validation-results");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 1. Calculate overall stats
  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;

  for (const r of results) {
    totalTests += r.passed + r.failed;
    totalPassed += r.passed;
    totalFailed += r.failed;
  }

  const successRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(2) : "0.00";

  // 2. Generate summary.md
  const timestamp = new Date().toISOString();
  let summaryContent = `# GitInsight Phase 3 — System Validation & Production Readiness Report

* **Generated:** ${timestamp}
* **Environment:** Validation Test Environment
* **Validation Target URL:** ${process.env.VALIDATION_BASE_URL || "http://localhost:3000"}
* **Total Execution Time:** ${(totalDurationMs / 1000).toFixed(2)} seconds
* **Success Rate:** ${successRate}% (${totalPassed} / ${totalTests} tests passed)

## Overall Status: ${totalFailed === 0 ? "🟢 PASS" : "🔴 FAIL"}

| Test Suite | Passed | Failed | Duration | Status |
|---|---|---|---|---|
`;

  for (const r of results) {
    const status = r.failed === 0 ? "🟢 PASS" : "🔴 FAIL";
    summaryContent += `| [${r.suiteName}](./${r.suiteName.toLowerCase()}.md) | ${r.passed} | ${r.failed} | ${(r.durationMs / 1000).toFixed(2)}s | ${status} |\n`;
  }

  summaryContent += `
## Validation Metrics Summary

* **Historical Sync Time:** ${(metricsCollector.getMetrics().historicalSyncTimeMs / 1000).toFixed(2)}s
* **Incremental Sync Time:** ${(metricsCollector.getMetrics().incrementalSyncTimeMs / 1000).toFixed(2)}s
* **Webhook Ingestion Latency:** ${metricsCollector.getMetrics().webhookLatencyMs}ms
* **Total API Requests Made:** ${metricsCollector.getMetrics().apiCalls}
* **Database Rows Created:** ${metricsCollector.getMetrics().databaseRowsCreated}
* **Duplicates Prevented:** ${metricsCollector.getMetrics().duplicatesPrevented}
`;

  fs.writeFileSync(path.join(outputDir, "summary.md"), summaryContent, "utf8");

  // Also output a root report named `validation-report.md` as requested in the initial checklist!
  const rootReportPath = path.join(process.cwd(), "validation-report.md");
  fs.writeFileSync(rootReportPath, summaryContent, "utf8");

  // 3. Generate detailed category markdown files
  for (const r of results) {
    let detailedContent = `# Validation Suite — ${r.suiteName}

* **Status:** ${r.failed === 0 ? "🟢 PASS" : "🔴 FAIL"}
* **Passed:** ${r.passed}
* **Failed:** ${r.failed}
* **Duration:** ${(r.durationMs / 1000).toFixed(2)} seconds

## Test Cases Detailed Logs

| Test Name | Status | Duration | Error/Details |
|---|---|---|---|
`;

    for (const t of r.tests) {
      const status = t.passed ? "🟢 PASS" : "🔴 FAIL";
      const errDetail = t.error ? `\`${t.error.replace(/\n/g, " ")}\`` : "None";
      detailedContent += `| ${t.name} | ${status} | ${t.durationMs}ms | ${errDetail} |\n`;
    }

    fs.writeFileSync(path.join(outputDir, `${r.suiteName.toLowerCase()}.md`), detailedContent, "utf8");
  }

  // 4. Save timings.json and metrics.json
  const timings = results.map((r) => ({
    suiteName: r.suiteName,
    durationMs: r.durationMs,
    passed: r.passed,
    failed: r.failed,
  }));
  fs.writeFileSync(path.join(outputDir, "timings.json"), JSON.stringify(timings, null, 2), "utf8");
  fs.writeFileSync(path.join(outputDir, "metrics.json"), JSON.stringify(metricsCollector.getMetrics(), null, 2), "utf8");

  // Save the metrics to the project root validation_metrics.json as requested
  metricsCollector.save();

  console.log(`Reports successfully generated in: ${outputDir}`);
}
