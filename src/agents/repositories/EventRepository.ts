import { db } from "@/lib/db";
import { ProjectEvent, EventEntityType, EventImportance, EventSource, ProcessingStatus } from "@prisma/client";

export interface LogEventData {
  actorName: string;
  title: string;
  description?: string;
  entityType?: EventEntityType;
  importance?: EventImportance;
  metadata?: any;
}

export class EventRepository {
  async logEvent(projectId: string, data: LogEventData): Promise<ProjectEvent> {
    return db.projectEvent.create({
      data: {
        engineeringProjectId: projectId,
        actorName: data.actorName,
        title: data.title,
        description: data.description || "",
        entityType: data.entityType || "AI_INSIGHT",
        importance: data.importance || "NORMAL",
        source: EventSource.SYSTEM,
        processingStatus: ProcessingStatus.COMPLETED,
        metadata: data.metadata || {},
      },
    });
  }

  async getRecentEvents(projectId: string, limit = 20): Promise<ProjectEvent[]> {
    return db.projectEvent.findMany({
      where: { engineeringProjectId: projectId },
      orderBy: { timestamp: "desc" },
      take: limit,
    });
  }
}
