import { TestResult, assert, assertEqual, TEST_USER_ID } from "../utils";
import { db } from "@/lib/db";
import { createEngineeringProject, listEngineeringProjects, deleteEngineeringProject } from "@/lib/projectService";

export async function runProjectIntegrationTests(): Promise<TestResult[]> {
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

  await runTest("Project Integration: Create, List, and Delete Engineering Project", async () => {
    const repo = await db.repository.create({
      data: {
        githubId: BigInt(88883333),
        name: "test-integration-repo",
        owner: "testowner",
        fullName: "testowner/test-integration-repo",
        htmlUrl: "https://github.com/testowner/test-integration-repo",
        userId: TEST_USER_ID,
      },
    });

    const project = await createEngineeringProject({
      name: "Integration Engineering Project",
      description: "Testing end to end project abstraction",
      ownerId: TEST_USER_ID,
      repositoryId: repo.id,
      jiraProjectKey: "AUTH",
    });

    assert(project !== null, "Created project should not be null");
    assertEqual(project?.name, "Integration Engineering Project", "Project name should match");

    const projectsList = await listEngineeringProjects(TEST_USER_ID);
    assert(projectsList.some((p) => p.id === project?.id), "Project should be listed in user's projects");

    // Cleanup
    await deleteEngineeringProject(project!.id);
    await db.repository.delete({ where: { id: repo.id } });
  });

  return results;
}
