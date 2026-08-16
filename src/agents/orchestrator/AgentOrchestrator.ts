import { AgentRegistry } from "../registry/AgentRegistry";
import { AgentChain } from "../chain/AgentChain";
import { AgentResult } from "../base/AgentResult";

export class AgentOrchestrator {
  private registry = AgentRegistry.getInstance();

  /**
   * Executes a named agent workflow pipeline for a given EngineeringProject ID.
   */
  public async runWorkflow(projectId: string, agentNames: string[] = ["SummaryAgent", "SprintHealthAgent"]): Promise<AgentResult[]> {
    const chain = AgentChain.builder();

    for (const name of agentNames) {
      const agent = this.registry.getAgent(name);
      if (!agent) {
        throw new Error(`Orchestrator Error: Agent '${name}' is not registered.`);
      }
      chain.then(agent);
    }

    return chain.execute(projectId);
  }
}
