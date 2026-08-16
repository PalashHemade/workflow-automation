export interface AgentPlanStep {
  stepNumber: number;
  description: string;
  toolName: string;
  expectedOutput: string;
}

export interface ReflectionEvaluation {
  isValid: boolean;
  confidence: number;
  requiresAdditionalContext: boolean;
  nextToolToExecute?: string;
  reason: string;
}

export interface AgentExecutionLog {
  timestamp: string;
  stage: "GOAL" | "PLAN" | "TOOL_SELECTION" | "RETRIEVE" | "ANALYZE" | "REFLECT" | "ACT" | "REMEMBER";
  message: string;
  details?: any;
}
