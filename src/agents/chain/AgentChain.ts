import { BaseAgent } from "../base/BaseAgent";
import { AgentResult } from "../base/AgentResult";

export class AgentChain {
  private pipeline: BaseAgent[] = [];

  public static builder(): AgentChain {
    return new AgentChain();
  }

  public then(agent: BaseAgent): this {
    this.pipeline.push(agent);
    return this;
  }

  public async execute(projectId: string, initialPayload?: any): Promise<AgentResult[]> {
    const results: AgentResult[] = [];
    let currentPayload = initialPayload;

    for (const agent of this.pipeline) {
      const result = await agent.execute(projectId, currentPayload);
      results.push(result);

      if (!result.success) {
        // Stop chain if an agent step fails
        break;
      }

      // Pass chained payload to next agent in pipeline
      currentPayload = result.chainedPayload;
    }

    return results;
  }
}
