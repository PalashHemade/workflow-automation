import { BaseTool } from "./BaseTool";
import { MetricsRepository } from "../repositories/MetricsRepository";

export interface GetMetricsArgs {
  projectId: string;
}

export class GetMetricsTool implements BaseTool<GetMetricsArgs, any> {
  public readonly name = "GetMetricsTool";
  public readonly description = "Retrieves ProjectMetrics (DORA metrics, velocity, cycle time) and recent pipeline runs.";

  private metricsRepo = new MetricsRepository();

  async execute(args: GetMetricsArgs): Promise<any> {
    const metrics = await this.metricsRepo.getProjectMetrics(args.projectId);
    const pipelines = await this.metricsRepo.getRecentPipelineRuns(args.projectId, 10);

    return {
      metrics,
      pipelines,
    };
  }
}
