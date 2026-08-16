import { db } from "@/lib/db";
import { AIInsight, InsightType, InsightSeverity, InsightStatus } from "@prisma/client";

export interface CreateInsightData {
  title: string;
  summary: string;
  type?: InsightType;
  severity?: InsightSeverity;
  status?: InsightStatus;
  confidence?: number;
  createdBy?: string;
  metadata?: any;
}

export class InsightRepository {
  async createInsight(projectId: string, data: CreateInsightData): Promise<AIInsight> {
    return db.aIInsight.create({
      data: {
        engineeringProjectId: projectId,
        title: data.title,
        summary: data.summary,
        type: data.type || "SUMMARY",
        severity: data.severity || "MEDIUM",
        status: data.status || "ACTIVE",
        confidence: data.confidence ?? 90.0,
        createdBy: data.createdBy || "AI_AGENT",
        metadata: data.metadata || {},
      },
    });
  }

  async getRecentInsights(projectId: string, limit = 10): Promise<AIInsight[]> {
    return db.aIInsight.findMany({
      where: { engineeringProjectId: projectId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}
