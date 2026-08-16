import { BaseTool } from "./BaseTool";
import { MetricsRepository } from "../repositories/MetricsRepository";

export interface GetStoriesArgs {
  projectId: string;
}

export class GetStoriesTool implements BaseTool<GetStoriesArgs, any> {
  public readonly name = "GetStoriesTool";
  public readonly description = "Retrieves active sprints and linked Jira stories/tasks.";

  private metricsRepo = new MetricsRepository();

  async execute(args: GetStoriesArgs): Promise<any> {
    const sprints = await this.metricsRepo.getActiveOrRecentSprints(args.projectId, 5);
    return {
      sprints,
    };
  }
}
