import { db } from "./db";
import { EventEntityType, EventImportance, EventSource, ProcessingStatus } from "@prisma/client";

export const EventType = {
  COMMIT_CREATED: "COMMIT",
  PR_OPENED: "PULL_REQUEST",
  PR_UPDATED: "PULL_REQUEST",
  PR_CLOSED: "PULL_REQUEST",
  PR_MERGED: "PULL_REQUEST",
  REVIEW_SUBMITTED: "PULL_REQUEST",
  REVIEW_APPROVED: "PULL_REQUEST",
  CHANGES_REQUESTED: "PULL_REQUEST",
  REVIEW_COMMENT: "PULL_REQUEST",
  BRANCH_CREATED: "SYSTEM",
  BRANCH_DELETED: "SYSTEM",
  REPOSITORY_SYNCED: "SYSTEM",
  SYNC_FAILED: "SYSTEM",
  WEBHOOK_RECEIVED: "SYSTEM",
} as const;

interface ProjectEventInput {
  repositoryId: string;
  eventType?: string;
  entityType: string | EventEntityType;
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

function parseEntityType(input: string | EventEntityType): EventEntityType {
  if (Object.values(EventEntityType).includes(input as EventEntityType)) {
    return input as EventEntityType;
  }
  const upper = String(input).toUpperCase();
  if (upper.includes("COMMIT")) return EventEntityType.COMMIT;
  if (upper.includes("PR") || upper.includes("PULL") || upper.includes("REVIEW")) return EventEntityType.PULL_REQUEST;
  if (upper.includes("STORY")) return EventEntityType.STORY;
  if (upper.includes("TASK") || upper.includes("BUG")) return EventEntityType.TASK;
  if (upper.includes("SPRINT")) return EventEntityType.SPRINT;
  if (upper.includes("PIPELINE") || upper.includes("BUILD")) return EventEntityType.PIPELINE;
  if (upper.includes("AI")) return EventEntityType.AI_INSIGHT;
  return EventEntityType.SYSTEM;
}

/**
 * Creates a ProjectEvent in the database, avoiding duplicate event entries.
 */
export async function createProjectEvent(input: ProjectEventInput) {
  try {
    const validEntityType = parseEntityType(input.entityType);

    if (input.entityId) {
      const existing = await db.projectEvent.findFirst({
        where: {
          repositoryId: input.repositoryId,
          entityType: validEntityType,
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
        entityType: validEntityType,
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
        timestamp: input.createdAt || new Date(),
      },
    });
  } catch (err) {
    console.error("Error creating project event:", err);
    return null;
  }
}

/**
 * Helper to locate parent PR event ID for reviews/comments.
 */
export async function findPREventId(repositoryId: string, pullRequestId: string): Promise<string | null> {
  const prEvent = await db.projectEvent.findFirst({
    where: {
      repositoryId,
      entityType: EventEntityType.PULL_REQUEST,
      entityId: pullRequestId,
    },
  });
  return prEvent?.id || null;
}

/**
 * Backfills missing historical events for commits and PRs.
 */
export async function backfillTimelineEvents(repositoryId: string) {
  const repo = await db.repository.findUnique({
    where: { id: repositoryId },
    include: {
      commits: true,
      pullRequests: {
        include: {
          reviews: { include: { comments: true } },
        },
      },
    },
  });

  if (!repo) return;

  // 1. Backfill Commits
  for (const commit of repo.commits) {
    await createProjectEvent({
      repositoryId,
      entityType: EventEntityType.COMMIT,
      entityId: commit.id,
      actorName: commit.authorName,
      title: `Commit created: ${commit.sha.slice(0, 7)}`,
      description: commit.message,
      importance: EventImportance.NORMAL,
      source: EventSource.SYNC,
      metadata: { sha: commit.sha, authorEmail: commit.authorEmail },
      createdAt: commit.committedAt,
    });
  }

  // 2. Backfill PRs
  for (const pr of repo.pullRequests) {
    const prEvent = await createProjectEvent({
      repositoryId,
      entityType: EventEntityType.PULL_REQUEST,
      entityId: pr.id,
      actorName: pr.authorName,
      title: `PR #${pr.number} ${pr.state}`,
      description: pr.title,
      importance: EventImportance.NORMAL,
      source: EventSource.SYNC,
      metadata: { number: pr.number, state: pr.state, merged: pr.merged },
      createdAt: pr.createdAt,
    });

    if (prEvent) {
      for (const review of pr.reviews) {
        await createProjectEvent({
          repositoryId,
          entityType: EventEntityType.PULL_REQUEST,
          entityId: review.id,
          parentEventId: prEvent.id,
          actorName: review.authorName,
          title: `Review ${review.state} on PR #${pr.number}`,
          description: review.body,
          importance: EventImportance.NORMAL,
          source: EventSource.SYNC,
          metadata: { reviewId: review.id, state: review.state },
          createdAt: review.submittedAt,
        });
      }
    }
  }
}
