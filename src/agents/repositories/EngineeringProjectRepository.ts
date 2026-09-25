import { db } from "@/lib/core/db";
import { ProjectKnowledge, ModuleKnowledge } from "@prisma/client";

export class EngineeringProjectRepository {
  async getProjectById(projectId: string) {
    return db.engineeringProject.findUnique({
      where: { id: projectId },
      include: {
        repositories: {
          include: { repository: true },
        },
      },
    });
  }

  async getProjectKnowledge(projectId: string): Promise<ProjectKnowledge | null> {
    return db.projectKnowledge.findUnique({
      where: { engineeringProjectId: projectId },
    });
  }

  async updateProjectKnowledge(
    projectId: string,
    data: {
      projectSummary?: string;
      architectureSummary?: string;
      riskSummary?: string;
      releaseSummary?: string;
      engineeringMemory?: string;
    }
  ): Promise<ProjectKnowledge> {
    return db.projectKnowledge.upsert({
      where: { engineeringProjectId: projectId },
      update: {
        ...data,
      },
      create: {
        engineeringProjectId: projectId,
        ...data,
      },
    });
  }

  async getModuleKnowledge(projectId: string): Promise<ModuleKnowledge[]> {
    return db.moduleKnowledge.findMany({
      where: { engineeringProjectId: projectId },
      take: 20,
    });
  }
}
