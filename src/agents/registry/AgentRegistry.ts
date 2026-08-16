import { BaseAgent } from "../base/BaseAgent";
import { SummaryAgent } from "../implementations/SummaryAgent";
import { SprintHealthAgent } from "../implementations/SprintHealthAgent";

export class AgentRegistry {
  private static instance: AgentRegistry;
  private agents: Map<string, BaseAgent> = new Map();

  private constructor() {
    this.autoRegisterDefaults();
  }

  public static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry();
    }
    return AgentRegistry.instance;
  }

  private autoRegisterDefaults(): void {
    this.registerAgent(new SummaryAgent());
    this.registerAgent(new SprintHealthAgent());
  }

  public registerAgent(agent: BaseAgent): void {
    this.agents.set(agent.name, agent);
  }

  public getAgent(agentName: string): BaseAgent | undefined {
    return this.agents.get(agentName);
  }

  public listAgents(): { name: string; description: string }[] {
    return Array.from(this.agents.values()).map((agent) => ({
      name: agent.name,
      description: agent.description,
    }));
  }
}
