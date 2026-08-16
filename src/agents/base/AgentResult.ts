import { ReflectionEvaluation, AgentExecutionLog } from "../types";

export interface AgentResult<TOutput = any> {
  success: boolean;
  agentName: string;
  projectId: string;
  executionId: string;
  output: TOutput;
  reflection?: ReflectionEvaluation;
  insightsCount: number;
  knowledgeUpdated: boolean;
  logs: AgentExecutionLog[];
  durationMs: number;
  error?: string;
  chainedPayload?: any;
}
