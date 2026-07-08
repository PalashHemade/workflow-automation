import { db } from "./db";
import { EventType, EventImportance, EventSource, ProcessingStatus } from "@prisma/client";

interface ProjectEventInput {
  repositoryId: string;
  eventType: EventType;
  entityType: string;
  entityId: string | null;
  parentEventId?: string | null;
  actorId?: string | null;
  actorName: string;
  title: string;
  description?: string | null;
  importance: EventImportance;
  source: EventSource;
  metadata: any;
  createdAt?: Date;
}

/**
 * Creates a ProjectEvent in the database, avoiding duplicate event entries.
 */
export async function createProjectEvent(input: ProjectEventInput) {
  try {
    // Deduplication check: for entity-based events (commits, PR actions, reviews, branches, comments),
    // ensure we don't insert duplicate events of the same EventType for the same entityId.
    if (input.entityId) {
      const existing = await db.projectEvent.findFirst({
        where: {
          repositoryId: input.repositoryId,
          eventType: input.eventType,
          entityId: input.entityId,
        },
      });
      if (existing) {
        return existing;
      }
    }

    return await db.projectEvent.create({
      data: {
        repositoryId: input.repositoryId,
        eventType: input.eventType,
        entityType: input.entityType,
        entityId: input.entityId,
        parentEventId: input.parentEventId || null,
        actorId: input.actorId || null,
        actorName: input.actorName,
        title: input.title,
        description: input.description || null,
        importance: input.importance,
        source: input.source,
        version: 1,
        processingStatus: ProcessingStatus.COMPLETED,
        processedAt: new Date(),
        metadata: input.metadata || {},
        createdAt: input.createdAt || new Date(),
      },
    });
  } catch (err) {
    console.error(`Failed to create ProjectEvent of type ${input.eventType}:`, err);
    return null;
  }
}

/**
 * Helper to link child events to their parent events (e.g. Commit/Review -> PR)
 */
export async function findPREventId(repositoryId: string, prId: string): Promise<string | null> {
  const prEvent = await db.projectEvent.findFirst({
    where: {
      repositoryId,
      entityId: prId,
      eventType: EventType.PR_OPENED,
    },
    select: { id: true },
  });
  return prEvent?.id || null;
}

/**
 * Scan database records for a repository and generate historical timeline events
 */
export async function backfillTimelineEvents(repositoryId: string) {
  try {
    // 1. Commits
    const commits = await db.commit.findMany({
      where: { repositoryId },
      orderBy: { committedAt: "asc" },
    });

    for (const c of commits) {
      await createProjectEvent({
        repositoryId,
        eventType: EventType.COMMIT_CREATED,
        entityType: "Commit",
        entityId: c.id,
        actorName: c.authorName,
        title: `Commit Pushed: ${c.message.split("\n")[0]}`,
        description: c.message,
        importance: EventImportance.LOW,
        source: EventSource.SYNC,
        createdAt: c.committedAt,
        metadata: {
          sha: c.sha,
          message: c.message,
          branch: "main",
          filesChanged: 0,
          insertions: 0,
          deletions: 0,
        },
      });
    }

    // 2. PRs
    const prs = await db.pullRequest.findMany({
      where: { repositoryId },
      orderBy: { createdAt: "asc" },
    });

    for (const pr of prs) {
      const prOpenedEvent = await createProjectEvent({
        repositoryId,
        eventType: EventType.PR_OPENED,
        entityType: "PullRequest",
        entityId: pr.id,
        actorName: pr.authorName,
        title: `PR Opened: #${pr.number} ${pr.title}`,
        description: pr.title,
        importance: EventImportance.NORMAL,
        source: EventSource.SYNC,
        createdAt: pr.createdAt,
        metadata: {
          prNumber: pr.number,
          title: pr.title,
          state: pr.state,
          commitsCount: 0,
          filesChanged: 0,
          reviewsCount: 0,
          mergeDurationMinutes: null,
        },
      });

      if (pr.state === "closed" && !pr.merged) {
        await createProjectEvent({
          repositoryId,
          eventType: EventType.PR_CLOSED,
          entityType: "PullRequest",
          entityId: pr.id,
          parentEventId: prOpenedEvent?.id,
          actorName: pr.authorName,
          title: `PR Closed: #${pr.number} ${pr.title}`,
          description: pr.title,
          importance: EventImportance.NORMAL,
          source: EventSource.SYNC,
          createdAt: pr.closedAt || pr.updatedAt,
          metadata: {
            prNumber: pr.number,
            title: pr.title,
            state: "closed",
          },
        });
      }

      if (pr.merged && pr.mergedAt) {
        const mergeDurationMinutes = Math.round((pr.mergedAt.getTime() - pr.createdAt.getTime()) / (1000 * 60));
        await createProjectEvent({
          repositoryId,
          eventType: EventType.PR_MERGED,
          entityType: "PullRequest",
          entityId: pr.id,
          parentEventId: prOpenedEvent?.id,
          actorName: pr.authorName,
          title: `PR Merged: #${pr.number} ${pr.title}`,
          description: pr.title,
          importance: EventImportance.HIGH,
          source: EventSource.SYNC,
          createdAt: pr.mergedAt,
          metadata: {
            prNumber: pr.number,
            title: pr.title,
            state: "merged",
            mergeDurationMinutes,
          },
        });
      }
    }

    // 3. Reviews
    const reviews = await db.review.findMany({
      where: { pullRequest: { repositoryId } },
      include: { pullRequest: true },
      orderBy: { submittedAt: "asc" },
    });

    for (const r of reviews) {
      const parentEventId = await findPREventId(repositoryId, r.pullRequestId);
      let reviewType: EventType = EventType.REVIEW_SUBMITTED;
      let importance: EventImportance = EventImportance.LOW;
      let reviewTitle = `PR Review Submitted by ${r.authorName}`;

      if (r.state === "APPROVED") {
        reviewType = EventType.REVIEW_APPROVED;
        importance = EventImportance.NORMAL;
        reviewTitle = `PR Approved by ${r.authorName}`;
      } else if (r.state === "CHANGES_REQUESTED") {
        reviewType = EventType.CHANGES_REQUESTED;
        importance = EventImportance.HIGH;
        reviewTitle = `PR Changes Requested by ${r.authorName}`;
      }

      await createProjectEvent({
        repositoryId,
        eventType: reviewType,
        entityType: "Review",
        entityId: r.id,
        parentEventId,
        actorName: r.authorName,
        title: reviewTitle,
        description: r.body || null,
        importance,
        source: EventSource.SYNC,
        createdAt: r.submittedAt,
        metadata: {
          reviewer: r.authorName,
          reviewState: r.state,
          commentsCount: 0,
          prTitle: r.pullRequest.title,
          prNumber: r.pullRequest.number,
        },
      });
    }

    // 4. Review Comments
    const comments = await db.reviewComment.findMany({
      where: { pullRequest: { repositoryId } },
      include: { pullRequest: true },
      orderBy: { createdAt: "asc" },
    });

    for (const c of comments) {
      const parentEventId = await findPREventId(repositoryId, c.pullRequestId);
      await createProjectEvent({
        repositoryId,
        eventType: EventType.REVIEW_COMMENT,
        entityType: "ReviewComment",
        entityId: c.id,
        parentEventId: parentEventId,
        actorName: c.authorName,
        title: `New PR Comment by ${c.authorName}`,
        description: c.body,
        importance: EventImportance.LOW,
        source: EventSource.SYNC,
        createdAt: c.createdAt,
        metadata: {
          reviewer: c.authorName,
          body: c.body,
          path: c.path,
          line: c.line,
          prTitle: c.pullRequest.title,
          prNumber: c.pullRequest.number,
        },
      });
    }
  } catch (err) {
    console.error(`Error in backfillTimelineEvents for repo ${repositoryId}:`, err);
  }
}

