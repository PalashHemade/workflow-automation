import { AgentPlanStep, ReflectionEvaluation, AgentExecutionLog } from "../types";

export class AgentContext<TInput = any> {
  public readonly projectId: string;
  public readonly goal: string;
  public readonly inputPayload?: TInput;
  public readonly executionId: string;

  public plan: AgentPlanStep[] = [];
  public selectedTools: string[] = [];
  public rawData: Record<string, any> = {};
  public compressedContext: Record<string, any> = {};
  public llmOutput: any = null;
  public reflection?: ReflectionEvaluation;
  public actionResult: any = null;
  public memoryUpdates: any = null;

  public logs: AgentExecutionLog[] = [];
  public startTime: number;

  constructor(projectId: string, goal: string, inputPayload?: TInput) {
    this.projectId = projectId;
    this.goal = goal;
    this.inputPayload = inputPayload;
    this.executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.startTime = Date.now();
  }

  public log(stage: AgentExecutionLog["stage"], message: string, details?: any) {
    this.logs.push({
      timestamp: new Date().toISOString(),
      stage,
      message,
      details,
    });
  }
}
