import { db } from "@/lib/db";
import { ProjectMetrics, Sprint, Story, PipelineRun } from "@prisma/client";

export class MetricsRepository {
  async getProjectMetrics(projectId: string): Promise<ProjectMetrics | null> {
    return db.projectMetrics.findUnique({
      where: { engineeringProjectId: projectId },
    });
  }

  async getActiveOrRecentSprints(projectId: string, limit = 5): Promise<(Sprint & { stories: Story[] })[]> {
    return db.sprint.findMany({
      where: { projectId },
      orderBy: { startDate: "desc" },
      take: limit,
      include: {
        stories: {
          include: {
            tasks: true,
            storyCommits: true,
            storyPullRequests: true,
          },
        },
      },
    });
  }

  async getRecentPipelineRuns(projectId: string, limit = 10): Promise<PipelineRun[]> {
    return db.pipelineRun.findMany({
      where: { engineeringProjectId: projectId },
      orderBy: { startedAt: "desc" },
      take: limit,
    });
  }
}
