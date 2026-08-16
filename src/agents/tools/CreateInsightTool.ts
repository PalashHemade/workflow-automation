import { BaseTool } from "./BaseTool";
import { InsightRepository, CreateInsightData } from "../repositories/InsightRepository";

export interface CreateInsightArgs {
  projectId: string;
  insight: CreateInsightData;
}

export class CreateInsightTool implements BaseTool<CreateInsightArgs, any> {
  public readonly name = "CreateInsightTool";
  public readonly description = "Persists an AIInsight entity to PostgreSQL via Prisma.";

  private insightRepo = new InsightRepository();

  async execute(args: CreateInsightArgs): Promise<any> {
    return this.insightRepo.createInsight(args.projectId, args.insight);
  }
}
