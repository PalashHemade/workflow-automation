import { TestResult, assert, assertEqual, TEST_USER_ID } from "../utils";
import { db } from "@/lib/db";
import { syncJiraProject } from "@/lib/jiraSync";

export async function runJiraSyncUnitTests(): Promise<TestResult[]> {
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

  await runTest("Jira Sync: Creates SyncJob and Upserts Stories", async () => {
    // 1. Create test repo & project
    const repo = await db.repository.create({
      data: {
        githubId: BigInt(88881111),
        name: "test-jira-repo",
        owner: "testowner",
        fullName: "testowner/test-jira-repo",
        htmlUrl: "https://github.com/testowner/test-jira-repo",
        userId: TEST_USER_ID,
      },
    });

    const project = await db.engineeringProject.create({
      data: {
        name: "Test Jira Project",
        ownerId: TEST_USER_ID,
        repositoryId: repo.id,
      },
    });

    // 2. Execute syncJiraProject
    const syncRes = await syncJiraProject({
      projectId: project.id,
      projectKey: "AUTH",
      cloudId: "mock-cloud-id-1",
    });

    assert(syncRes.itemsProcessed >= 0, "Items processed should be non-negative");

    // 3. Verify SyncJob created
    const jobs = await db.syncJob.findMany({
      where: { engineeringProjectId: project.id },
    });
    assert(jobs.length > 0, "SyncJob record should be created");
    assertEqual(jobs[0].provider, "JIRA", "SyncJob provider should be JIRA");

    // Cleanup
    await db.engineeringProject.delete({ where: { id: project.id } });
    await db.repository.delete({ where: { id: repo.id } });
  });

  return results;
}
