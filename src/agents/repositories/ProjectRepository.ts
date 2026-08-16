import { db } from "@/lib/db";
import { EngineeringProject, ProjectKnowledge, ModuleKnowledge } from "@prisma/client";

export class ProjectRepository {
  async getProjectById(projectId: string): Promise<EngineeringProject | null> {
    return db.engineeringProject.findUnique({
      where: { id: projectId },
      include: {
        repository: true,
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
