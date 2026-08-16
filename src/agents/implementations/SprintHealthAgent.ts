import { BaseAgent } from "../base/BaseAgent";
import { AgentContext } from "../base/AgentContext";
import { AgentPlanStep } from "../types";
import { BaseTool } from "../tools/BaseTool";
import { GetProjectTool } from "../tools/GetProjectTool";
import { GetStoriesTool } from "../tools/GetStoriesTool";
import { GetMetricsTool } from "../tools/GetMetricsTool";
import { sprintTaskPrompt } from "@/llm/prompts/tasks/sprint.task";
import { SprintOutput, validateSprintOutput } from "@/llm/schemas/SprintSchema";

export class SprintHealthAgent extends BaseAgent<any, SprintOutput> {
  public readonly name = "SprintHealthAgent";
  public readonly description = "Analyzes active sprint health, delayed story bottlenecks, unlinked commits, and deployment risks.";

  protected defineGoal(): string {
    return "Detect active sprint bottlenecks, unlinked commits, and deployment risks.";
  }

  protected async planner(ctx: AgentContext<any>): Promise<AgentPlanStep[]> {
    return [
      {
        stepNumber: 1,
        description: "Retrieve project info and existing project knowledge.",
        toolName: "GetProjectTool",
        expectedOutput: "EngineeringProject & ProjectKnowledge",
      },
      {
        stepNumber: 2,
        description: "Fetch active sprint stories, tasks, and commit linkages.",
        toolName: "GetStoriesTool",
        expectedOutput: "Sprint array with nested stories",
      },
      {
        stepNumber: 3,
        description: "Fetch CI/CD pipeline runs and performance metrics.",
        toolName: "GetMetricsTool",
        expectedOutput: "ProjectMetrics and PipelineRuns",
      },
      {
        stepNumber: 4,
        description: "Analyze sprint bottlenecks and risks via Groq LLM.",
        toolName: "LLMProvider",
        expectedOutput: "SprintOutput JSON",
      },
      {
        stepNumber: 5,
        description: "Persist sprint risk AIInsight in PostgreSQL.",
        toolName: "CreateInsightTool",
        expectedOutput: "Created AIInsight entity",
      },
    ];
  }

  protected async selectTools(): Promise<BaseTool[]> {
    return [
      new GetProjectTool(),
      new GetStoriesTool(),
      new GetMetricsTool(),
    ];
  }

  protected getTaskPrompt(): string {
    return sprintTaskPrompt;
  }

  protected validateAndParseOutput(rawLlmOutput: any): SprintOutput {
    return validateSprintOutput(rawLlmOutput);
  }

  protected async act(ctx: AgentContext<any>, output: SprintOutput): Promise<any> {
    // Persist Sprint Health AIInsight
    const insight = await this.memoryManager.saveInsight(ctx.projectId, {
      title: `Sprint Health Analysis - Risk Level: ${output.risk}`,
      summary: `Detected ${output.issues.length} sprint health issue(s). Main recommendations: ${output.recommendations.join(", ")}`,
      type: "RISK",
      severity: output.risk as any,
      confidence: output.confidence * 100,
      createdBy: this.name,
      metadata: {
        issues: output.issues,
        recommendations: output.recommendations,
      },
    });

    return {
      knowledgeUpdated: false,
      insightsCreated: 1,
      insightId: insight.id,
    };
  }
}
