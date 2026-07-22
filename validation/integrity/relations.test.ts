import { TestResult, assertEqual } from "../utils";
import { db } from "@/lib/db";

export async function runRelationsIntegrityTests(): Promise<TestResult[]> {
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

  await runTest("Database relation integrity: CommitFile references", async () => {
    const commitFiles = await db.commitFile.findMany({
      select: { commitId: true },
    });
    const commits = await db.commit.findMany({
      select: { id: true },
    });
    const commitIds = new Set(commits.map((c) => c.id));
    const orphans = commitFiles.filter((cf) => !commitIds.has(cf.commitId));
    assertEqual(orphans.length, 0, "No CommitFile should exist without an associated Commit");
  });

  await runTest("Database relation integrity: Review references", async () => {
    const reviews = await db.review.findMany({
      select: { pullRequestId: true },
    });
    const prs = await db.pullRequest.findMany({
      select: { id: true },
    });
    const prIds = new Set(prs.map((p) => p.id));
    const orphans = reviews.filter((r) => !prIds.has(r.pullRequestId));
    assertEqual(orphans.length, 0, "No Review should exist without an associated PullRequest");
  });

  await runTest("Database relation integrity: Branch references", async () => {
    const branches = await db.branch.findMany({
      select: { repositoryId: true },
    });
    const repos = await db.repository.findMany({
      select: { id: true },
    });
    const repoIds = new Set(repos.map((r) => r.id));
    const orphans = branches.filter((b) => !repoIds.has(b.repositoryId));
    assertEqual(orphans.length, 0, "No Branch should exist without an associated Repository");
  });

  await runTest("Database relation integrity: ProjectEvent references", async () => {
    const events = await db.projectEvent.findMany({
      select: { repositoryId: true },
    });
    const repos = await db.repository.findMany({
      select: { id: true },
    });
    const repoIds = new Set(repos.map((r) => r.id));
    const orphans = events.filter((e) => e.repositoryId && !repoIds.has(e.repositoryId));
    assertEqual(orphans.length, 0, "No ProjectEvent should exist without an associated Repository");
  });

  return results;
}
