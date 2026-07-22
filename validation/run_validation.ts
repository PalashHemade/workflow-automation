import { setupTestContext, teardownTestContext, TestSuiteResult, TestResult } from "./utils";
import { generateReport } from "./report/generateReport";

// Suite imports - Phase 1 to 4
import { runSmokeTests } from "./smoke/smoke.test";
import { runAuthUnitTests } from "./unit/auth.test";
import { runWebhookUnitTests } from "./unit/webhook.test";
import { runGithubFetchUnitTests } from "./unit/github_fetch.test";
import { runSchedulerUnitTests } from "./unit/scheduler.test";
import { runSyncEngineUnitTests } from "./unit/sync_engine.test";
import { runAnalyticsUnitTests } from "./unit/analytics.test";

import { runRepositoryIntegrationTests } from "./integration/repository.test";
import { runCommitsIntegrationTests } from "./integration/commits.test";
import { runPullsIntegrationTests } from "./integration/pulls.test";
import { runTimelineIntegrationTests } from "./integration/timeline.test";
import { runMetricsIntegrationTests } from "./integration/metrics.test";
import { runLifecycleIntegrationTests } from "./integration/lifecycle.test";

import { runOnboardingSystemTests } from "./system/onboarding_flow.test";
import { runSyncSystemTests } from "./system/sync_flow.test";
import { runWebhookSystemTests } from "./system/webhook_flow.test";
import { runFullRepositorySystemTests } from "./system/full_repository_flow.test";

import { runHistoricalSyncPerformanceTests } from "./performance/historical_sync.test";
import { runIncrementalSyncPerformanceTests } from "./performance/incremental_sync.test";
import { runWebhookLatencyPerformanceTests } from "./performance/webhook_latency.test";

import { runOAuthSecurityTests } from "./security/oauth.test";
import { runWebhookSignatureSecurityTests } from "./security/webhook_signature.test";
import { runAuthorizationSecurityTests } from "./security/authorization.test";

import { runRelationsIntegrityTests } from "./integrity/relations.test";
import { runCascadeDeleteIntegrityTests } from "./integrity/cascade_delete.test";
import { runDuplicateDetectionIntegrityTests } from "./integrity/duplicate_detection.test";

import { runBigIntRegressionTests } from "./regression/bigint_serialization.test";
import { runPreviousBugRegressionTests } from "./regression/previous_bug_tests";

// Phase 5 Suites
import { runJiraSyncUnitTests } from "./unit/jira_sync.test";
import { runCorrelationEngineUnitTests } from "./unit/correlation_engine.test";
import { runProjectIntegrationTests } from "./integration/project.test";

async function executeSuite(
  name: string,
  runFn: () => Promise<TestResult[]>
): Promise<TestSuiteResult> {
  console.log(`\n========================================`);
  console.log(`Running Suite: ${name}`);
  console.log(`========================================`);
  
  const startTime = Date.now();
  let tests: TestResult[] = [];
  try {
    tests = await runFn();
  } catch (err: any) {
    console.error(`Suite ${name} crashed during execution:`, err);
    tests = [
      {
        name: "Suite execution",
        passed: false,
        durationMs: Date.now() - startTime,
        error: err.message || String(err),
      },
    ];
  }

  const durationMs = Date.now() - startTime;
  const passed = tests.filter((t) => t.passed).length;
  const failed = tests.filter((t) => !t.passed).length;

  console.log(`Suite ${name} completed: ${passed} passed, ${failed} failed in ${durationMs}ms`);
  return {
    suiteName: name,
    passed,
    failed,
    durationMs,
    tests,
  };
}

async function main() {
  const globalStartTime = Date.now();
  let hasCrashed = false;
  const suiteResults: TestSuiteResult[] = [];

  try {
    // 1. Initialize test user session
    await setupTestContext();

    // 2. Sequential execution of test suites
    // Phase 1 Suites
    suiteResults.push(await executeSuite("Smoke", runSmokeTests));
    suiteResults.push(await executeSuite("Unit-Auth", runAuthUnitTests));
    suiteResults.push(await executeSuite("Unit-Webhook", runWebhookUnitTests));
    suiteResults.push(await executeSuite("Unit-GithubFetch", runGithubFetchUnitTests));
    suiteResults.push(await executeSuite("Unit-Scheduler", runSchedulerUnitTests));
    suiteResults.push(await executeSuite("Unit-SyncEngine", runSyncEngineUnitTests));
    suiteResults.push(await executeSuite("Unit-Analytics", runAnalyticsUnitTests));

    // Phase 2 Suites
    suiteResults.push(await executeSuite("Integration-Repository", runRepositoryIntegrationTests));
    suiteResults.push(await executeSuite("Integration-Commits", runCommitsIntegrationTests));
    suiteResults.push(await executeSuite("Integration-Pulls", runPullsIntegrationTests));
    suiteResults.push(await executeSuite("Integration-Timeline", runTimelineIntegrationTests));
    suiteResults.push(await executeSuite("Integration-Metrics", runMetricsIntegrationTests));
    suiteResults.push(await executeSuite("Integration-Lifecycle", runLifecycleIntegrationTests));
    suiteResults.push(await executeSuite("Security-OAuth", runOAuthSecurityTests));
    suiteResults.push(await executeSuite("Security-WebhookSignature", runWebhookSignatureSecurityTests));
    suiteResults.push(await executeSuite("Security-Authorization", runAuthorizationSecurityTests));
    suiteResults.push(await executeSuite("Regression-BigInt", runBigIntRegressionTests));
    suiteResults.push(await executeSuite("Regression-PreviousBugs", runPreviousBugRegressionTests));

    // Phase 3 Suites
    suiteResults.push(await executeSuite("System-Onboarding", runOnboardingSystemTests));
    suiteResults.push(await executeSuite("System-Sync", runSyncSystemTests));
    suiteResults.push(await executeSuite("System-Webhook", runWebhookSystemTests));
    suiteResults.push(await executeSuite("System-FullRepository", runFullRepositorySystemTests));
    suiteResults.push(await executeSuite("Integrity-Relations", runRelationsIntegrityTests));
    suiteResults.push(await executeSuite("Integrity-CascadeDelete", runCascadeDeleteIntegrityTests));
    suiteResults.push(await executeSuite("Integrity-DuplicateDetection", runDuplicateDetectionIntegrityTests));

    // Phase 4 Suites
    suiteResults.push(await executeSuite("Performance-HistoricalSync", runHistoricalSyncPerformanceTests));
    suiteResults.push(await executeSuite("Performance-IncrementalSync", runIncrementalSyncPerformanceTests));
    suiteResults.push(await executeSuite("Performance-WebhookLatency", runWebhookLatencyPerformanceTests));

    // Phase 5 Suites
    suiteResults.push(await executeSuite("Unit-JiraSync", runJiraSyncUnitTests));
    suiteResults.push(await executeSuite("Unit-CorrelationEngine", runCorrelationEngineUnitTests));
    suiteResults.push(await executeSuite("Integration-Project", runProjectIntegrationTests));

  } catch (error) {
    console.error("Critical error in validation pipeline:", error);
    hasCrashed = true;
  } finally {
    // 3. Clean up session and temporary database data
    await teardownTestContext();

    const globalDurationMs = Date.now() - globalStartTime;

    // 4. Generate validation results markdown and JSON metrics
    generateReport(suiteResults, globalDurationMs);

    // 5. Compute overall execution summary
    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;

    for (const r of suiteResults) {
      totalTests += r.passed + r.failed;
      totalPassed += r.passed;
      totalFailed += r.failed;
    }

    console.log(`\n========================================`);
    console.log(`VALIDATION PROCESS FINISHED`);
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${totalPassed}`);
    console.log(`Failed: ${totalFailed}`);
    console.log(`Duration: ${(globalDurationMs / 1000).toFixed(2)}s`);
    console.log(`========================================`);

    if (totalFailed > 0 || hasCrashed) {
      console.error("Validation pipeline failed. Exiting with error code.");
      process.exit(1);
    } else {
      console.log("Validation pipeline completed successfully.");
      process.exit(0);
    }
  }
}

main();
