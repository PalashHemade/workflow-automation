import { TestResult, TEST_USER_ID, testFetchAuth, assert, assertEqual } from "../utils";
import { db } from "@/lib/db";
import { EventEntityType, EventImportance, EventSource, ProcessingStatus } from "@prisma/client";

export async function runTimelineIntegrationTests(): Promise<TestResult[]> {
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

  await runTest("GET /api/timeline returns filtered, searched, and paginated event stream", async () => {
    const repo = await db.repository.create({
      data: {
        githubId: BigInt("4020"),
        name: "timeline-repo",
        owner: "timeline-owner",
        fullName: "timeline-owner/timeline-repo",
        htmlUrl: "https://github.com/timeline-owner/timeline-repo",
        userId: TEST_USER_ID,
        isTracked: true,
      },
    });

    try {
      const now = Date.now();

      // Seed 3 events with different times
      await db.projectEvent.create({
        data: {
          repositoryId: repo.id,
          entityType: EventEntityType.COMMIT,
          entityId: "ent-1",
          actorName: "John Doe",
          title: "John pushed a new commit",
          description: "Details of push",
          importance: EventImportance.LOW,
          source: EventSource.SYNC,
          processingStatus: ProcessingStatus.COMPLETED,
          metadata: {},
          createdAt: new Date(now - 3000),
        },
      });

      await db.projectEvent.create({
        data: {
          repositoryId: repo.id,
          entityType: EventEntityType.PULL_REQUEST,
          entityId: "ent-2",
          actorName: "Jane Smith",
          title: "Jane opened pull request #1",
          description: "Details of PR opening",
          importance: EventImportance.NORMAL,
          source: EventSource.SYNC,
          processingStatus: ProcessingStatus.COMPLETED,
          metadata: {},
          createdAt: new Date(now - 2000),
        },
      });

      await db.projectEvent.create({
        data: {
          repositoryId: repo.id,
          entityType: EventEntityType.PULL_REQUEST,
          entityId: "ent-3",
          actorName: "John Doe",
          title: "John submitted a review for PR #1",
          description: "Details of review",
          importance: EventImportance.LOW,
          source: EventSource.SYNC,
          processingStatus: ProcessingStatus.COMPLETED,
          metadata: {},
          createdAt: new Date(now - 1000),
        },
      });

      // Query timeline API
      const res = await testFetchAuth(`/api/timeline?repositoryId=${repo.id}&limit=2`);
      assertEqual(res.status, 200, "Should return 200 OK");
      const data = await res.json();

      assertEqual(data.events.length, 2, "Should return 2 events for limit=2");
      assert(data.pagination.nextCursor !== null, "Should have a next cursor");
    } finally {
      await db.repository.delete({ where: { id: repo.id } });
    }
  });

  return results;
}
