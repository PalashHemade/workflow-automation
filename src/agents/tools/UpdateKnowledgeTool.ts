import { BaseTool } from "./BaseTool";
import { EngineeringProjectRepository } from "../repositories/EngineeringProjectRepository";

export interface UpdateKnowledgeArgs {
  projectId: string;
  data: {
    projectSummary?: string;
    architectureSummary?: string;
    riskSummary?: string;
    releaseSummary?: string;
    engineeringMemory?: string;
  };
}

export class UpdateKnowledgeTool implements BaseTool<UpdateKnowledgeArgs, any> {
  public readonly name = "UpdateKnowledgeTool";
  public readonly description = "Updates persistent ProjectKnowledge in PostgreSQL via Prisma.";

  private projectRepo = new EngineeringProjectRepository();

  async execute(args: UpdateKnowledgeArgs): Promise<any> {
    return this.projectRepo.updateProjectKnowledge(args.projectId, args.data);
  }
}
