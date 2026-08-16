import { BaseAgent } from "../base/BaseAgent";
import { AgentContext } from "../base/AgentContext";
import { AgentPlanStep } from "../types";
import { BaseTool } from "../tools/BaseTool";
import { GetProjectTool } from "../tools/GetProjectTool";
import { GetMetricsTool } from "../tools/GetMetricsTool";
import { SearchTimelineTool } from "../tools/SearchTimelineTool";
import { summaryTaskPrompt } from "@/llm/prompts/tasks/summary.task";
import { SummaryOutput, validateSummaryOutput } from "@/llm/schemas/SummarySchema";

export class SummaryAgent extends BaseAgent<any, SummaryOutput> {
  public readonly name = "SummaryAgent";
  public readonly description = "Synthesizes architectural summaries, engineering risks, and recommendations into persistent project memory.";

  protected defineGoal(): string {
    return "Analyze project architectural health, summarize engineering context, and persist knowledge updates.";
  }

  protected async planner(ctx: AgentContext<any>): Promise<AgentPlanStep[]> {
    return [
      {
        stepNumber: 1,
        description: "Retrieve project details, repository configuration, and existing memory.",
        toolName: "GetProjectTool",
        expectedOutput: "EngineeringProject & ProjectKnowledge objects",
      },
      {
        stepNumber: 2,
        description: "Fetch DORA metrics and pipeline execution status.",
        toolName: "GetMetricsTool",
        expectedOutput: "ProjectMetrics and PipelineRun array",
      },
      {
        stepNumber: 3,
        description: "Search system events timeline.",
        toolName: "SearchTimelineTool",
        expectedOutput: "ProjectEvent array",
      },
      {
        stepNumber: 4,
        description: "Compress raw entities into compact context JSON and perform Groq LLM analysis.",
        toolName: "LLMProvider",
        expectedOutput: "SummaryOutput JSON",
      },
      {
        stepNumber: 5,
        description: "Update ProjectKnowledge and record AIInsight in PostgreSQL.",
        toolName: "UpdateKnowledgeTool & CreateInsightTool",
        expectedOutput: "Saved database entities",
      },
    ];
  }

  protected async selectTools(): Promise<BaseTool[]> {
    return [
      new GetProjectTool(),
      new GetMetricsTool(),
      new SearchTimelineTool(),
    ];
  }

  protected getTaskPrompt(): string {
    return summaryTaskPrompt;
  }

  protected validateAndParseOutput(rawLlmOutput: any): SummaryOutput {
    return validateSummaryOutput(rawLlmOutput);
  }

  protected async act(ctx: AgentContext<any>, output: SummaryOutput): Promise<any> {
    // Update persistent project knowledge via MemoryManager
    const knowledge = await this.memoryManager.saveKnowledgeUpdate(ctx.projectId, {
      projectSummary: output.summary,
      architectureSummary: output.architecture,
      riskSummary: output.risks.join("; "),
      engineeringMemory: `Last updated by SummaryAgent at ${new Date().toISOString()}`,
    });

    // Create AIInsight record
    const insight = await this.memoryManager.saveInsight(ctx.projectId, {
      title: "Project Architectural Health & Risk Summary",
      summary: output.summary,
      type: "SUMMARY",
      severity: output.risks.length > 2 ? "HIGH" : "MEDIUM",
      confidence: output.confidence * 100,
      createdBy: this.name,
      metadata: {
        architecture: output.architecture,
        risks: output.risks,
        recommendations: output.recommendations,
      },
    });

    return {
      knowledgeUpdated: true,
      insightsCreated: 1,
      knowledgeId: knowledge.id,
      insightId: insight.id,
    };
  }
}
