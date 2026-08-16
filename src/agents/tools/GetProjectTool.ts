import { BaseTool } from "./BaseTool";
import { ProjectRepository } from "../repositories/ProjectRepository";

export interface GetProjectArgs {
  projectId: string;
}

export class GetProjectTool implements BaseTool<GetProjectArgs, any> {
  public readonly name = "GetProjectTool";
  public readonly description = "Retrieves EngineeringProject details, repository info, and existing knowledge.";

  private projectRepo = new ProjectRepository();

  async execute(args: GetProjectArgs): Promise<any> {
    const project = await this.projectRepo.getProjectById(args.projectId);
    const knowledge = await this.projectRepo.getProjectKnowledge(args.projectId);
    const modules = await this.projectRepo.getModuleKnowledge(args.projectId);

    return {
      project,
      knowledge,
      modules,
    };
  }
}
