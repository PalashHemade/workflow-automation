import { ProjectRepository } from "../repositories/ProjectRepository";
import { InsightRepository, CreateInsightData } from "../repositories/InsightRepository";
import { EventRepository, LogEventData } from "../repositories/EventRepository";
import { AIInsight, ProjectKnowledge, ProjectEvent } from "@prisma/client";

export class MemoryManager {
  private projectRepo = new ProjectRepository();
  private insightRepo = new InsightRepository();
  private eventRepo = new EventRepository();

  async getProjectKnowledge(projectId: string): Promise<ProjectKnowledge | null> {
    return this.projectRepo.getProjectKnowledge(projectId);
  }

  async saveKnowledgeUpdate(
    projectId: string,
    updates: {
      projectSummary?: string;
      architectureSummary?: string;
      riskSummary?: string;
      releaseSummary?: string;
      engineeringMemory?: string;
    }
  ): Promise<ProjectKnowledge> {
    return this.projectRepo.updateProjectKnowledge(projectId, updates);
  }

  async saveInsight(projectId: string, insightData: CreateInsightData): Promise<AIInsight> {
    return this.insightRepo.createInsight(projectId, insightData);
  }

  async logExecutionEvent(projectId: string, logData: LogEventData): Promise<ProjectEvent> {
    return this.eventRepo.logEvent(projectId, logData);
  }
}
