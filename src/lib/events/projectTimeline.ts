import { db } from "@/lib/db";
import { IntegrationProvider, EventEntityType, EventImportance } from "@prisma/client";

export interface TimelineQueryOptions {
  projectId: string;
  provider?: IntegrationProvider;
  entityType?: EventEntityType;
  importance?: EventImportance;
  limit?: number;
  offset?: number;
}

export async function getUnifiedTimeline(options: TimelineQueryOptions) {
  const { projectId, provider, entityType, importance, limit = 50, offset = 0 } = options;

  const project = await db.engineeringProject.findUnique({
    where: { id: projectId },
    select: { repositoryId: true },
  });

  if (!project) {
    throw new Error(`EngineeringProject ${projectId} not found`);
  }

  const whereClause: any = {
    OR: [
      { engineeringProjectId: projectId },
      { repositoryId: project.repositoryId },
    ],
  };

  if (provider) {
    whereClause.provider = provider;
  }
  if (entityType) {
    whereClause.entityType = entityType;
  }
  if (importance) {
    whereClause.importance = importance;
  }

  const events = await db.projectEvent.findMany({
    where: whereClause,
    orderBy: { timestamp: "desc" },
    take: limit,
    skip: offset,
  });

  const total = await db.projectEvent.count({ where: whereClause });

  return {
    events: events.map((event) => ({
      id: event.id,
      provider: event.provider,
      entityType: event.entityType,
      entityId: event.entityId,
      actorName: event.actorName,
      title: event.title,
      description: event.description,
      importance: event.importance,
      source: event.source,
      metadata: event.metadata,
      timestamp: event.timestamp,
    })),
    total,
    limit,
    offset,
  };
}

export async function emitProjectEvent(data: {
  engineeringProjectId: string;
  provider: IntegrationProvider;
  entityType: EventEntityType;
  entityId?: string;
  actorName: string;
  title: string;
  description?: string;
  importance?: EventImportance;
  metadata?: Record<string, any>;
}) {
  return db.projectEvent.create({
    data: {
      engineeringProjectId: data.engineeringProjectId,
      provider: data.provider,
      entityType: data.entityType,
      entityId: data.entityId,
      actorName: data.actorName,
      title: data.title,
      description: data.description,
      importance: data.importance || "NORMAL",
      metadata: data.metadata || {},
      timestamp: new Date(),
    },
  });
}
