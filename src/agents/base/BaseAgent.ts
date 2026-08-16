import { AgentContext } from "./AgentContext";
import { AgentResult } from "./AgentResult";
import { AgentPlanStep, ReflectionEvaluation } from "../types";
import { BaseTool } from "../tools/BaseTool";
import { ContextManager } from "../memory/ContextManager";
import { MemoryManager } from "../memory/MemoryManager";
import { LLMFactory } from "@/llm/providers/LLMFactory";
import { LLMProvider } from "@/llm/providers/LLMProvider";
import { baseSystemPrompt } from "@/llm/prompts/system/base.system";

export abstract class BaseAgent<TInput = any, TOutput = any> {
  public abstract readonly name: string;
  public abstract readonly description: string;

  protected contextManager = new ContextManager();
  protected memoryManager = new MemoryManager();
  protected llmProvider: LLMProvider;

  constructor(llmProviderName?: string) {
    this.llmProvider = LLMFactory.getProvider(llmProviderName);
  }

  protected abstract defineGoal(inputPayload?: TInput): string;
  protected abstract planner(ctx: AgentContext<TInput>): Promise<AgentPlanStep[]>;
  protected abstract selectTools(ctx: AgentContext<TInput>): Promise<BaseTool[]>;
  protected abstract getTaskPrompt(ctx: AgentContext<TInput>): string;
  protected abstract validateAndParseOutput(rawLlmOutput: any): TOutput;
  protected abstract act(ctx: AgentContext<TInput>, output: TOutput): Promise<any>;

  /**
   * Primary entry point executing the 8-stage deterministic agent lifecycle.
   */
  public async execute(projectId: string, inputPayload?: TInput): Promise<AgentResult<TOutput>> {
    const goal = this.defineGoal(inputPayload);
    const ctx = new AgentContext<TInput>(projectId, goal, inputPayload);

    try {
      // 1. Goal
      ctx.log("GOAL", `Goal initialized: ${goal}`);

      // 2. Plan
      ctx.plan = await this.planner(ctx);
      ctx.log("PLAN", `Planned ${ctx.plan.length} execution steps`);

      // 3. Tool Selection
      const tools = await this.selectTools(ctx);
      ctx.selectedTools = tools.map((t) => t.name);
      ctx.log("TOOL_SELECTION", `Selected tools: ${ctx.selectedTools.join(", ")}`);

      // 4. Retrieve Context (Execute tools + Context Compression)
      ctx.log("RETRIEVE", "Retrieving context via Tools and Prisma repositories...");
      const rawData: Record<string, any> = {};
      for (const tool of tools) {
        // Execute tool using context args
        const toolResult = await tool.execute({ projectId, ...inputPayload });
        rawData[tool.name] = toolResult;

        // Spread specific tool outputs for context compression
        if (toolResult.project) rawData.project = toolResult.project;
        if (toolResult.knowledge) rawData.knowledge = toolResult.knowledge;
        if (toolResult.modules) rawData.modules = toolResult.modules;
        if (toolResult.metrics) rawData.metrics = toolResult.metrics;
        if (toolResult.sprints) rawData.sprints = toolResult.sprints;
        if (toolResult.commits) rawData.commits = toolResult.commits;
        if (toolResult.pullRequests) rawData.pullRequests = toolResult.pullRequests;
        if (toolResult.pipelines) rawData.pipelines = toolResult.pipelines;
        if (toolResult.events) rawData.events = toolResult.events;
      }

      ctx.rawData = rawData;
      ctx.compressedContext = this.contextManager.compressContext(rawData);
      ctx.log("RETRIEVE", "Context compressed into optimized JSON for LLM");

      // 5. Analyze (LLM Stage - ONLY stage using AI)
      ctx.log("ANALYZE", `Invoking LLM (${this.llmProvider.name}) with compressed context`);
      const taskPrompt = this.getTaskPrompt(ctx);
      const userPrompt = taskPrompt.replace(
        "{{CONTEXT_JSON}}",
        JSON.stringify(ctx.compressedContext, null, 2)
      );

      const parsedOutput = await this.llmProvider.generateStructured<TOutput>({
        systemPrompt: baseSystemPrompt,
        userPrompt,
        validator: (data) => this.validateAndParseOutput(data),
      });

      ctx.llmOutput = parsedOutput;
      ctx.log("ANALYZE", "LLM response generated and validated against schema");

      // 6. Reflect
      ctx.reflection = await this.reflect(ctx, parsedOutput);
      ctx.log("REFLECT", `Reflection status: Valid=${ctx.reflection.isValid}, Confidence=${ctx.reflection.confidence}`);

      if (!ctx.reflection.isValid) {
        throw new Error(`Agent Reflection Failed: ${ctx.reflection.reason}`);
      }

      // 7. Act
      ctx.log("ACT", "Executing action tools to persist insights and update knowledge...");
      ctx.actionResult = await this.act(ctx, parsedOutput);

      // 8. Remember
      ctx.log("REMEMBER", "Persisting execution logs and updates to ProjectEvent memory");
      await this.remember(ctx);

      const durationMs = Date.now() - ctx.startTime;
      return {
        success: true,
        agentName: this.name,
        projectId: ctx.projectId,
        executionId: ctx.executionId,
        output: parsedOutput,
        reflection: ctx.reflection,
        insightsCount: ctx.actionResult?.insightsCreated || 1,
        knowledgeUpdated: ctx.actionResult?.knowledgeUpdated || false,
        logs: ctx.logs,
        durationMs,
        chainedPayload: parsedOutput,
      };
    } catch (err: any) {
      const durationMs = Date.now() - ctx.startTime;
      ctx.log("REMEMBER", `Execution error encountered: ${err.message}`);

      return {
        success: false,
        agentName: this.name,
        projectId: ctx.projectId,
        executionId: ctx.executionId,
        output: null as any,
        logs: ctx.logs,
        durationMs,
        insightsCount: 0,
        knowledgeUpdated: false,
        error: err.message,
      };
    }
  }

  /**
   * Reflection stage evaluating LLM output quality and confidence.
   */
  protected async reflect(ctx: AgentContext<TInput>, output: TOutput): Promise<ReflectionEvaluation> {
    if (!output || typeof output !== "object") {
      return {
        isValid: false,
        confidence: 0,
        requiresAdditionalContext: false,
        reason: "LLM output is null or not an object.",
      };
    }

    const confidence = (output as any).confidence ?? 0.85;
    if (confidence < 0.5) {
      return {
        isValid: false,
        confidence,
        requiresAdditionalContext: true,
        reason: `Confidence score too low (${confidence}).`,
      };
    }

    return {
      isValid: true,
      confidence,
      requiresAdditionalContext: false,
      reason: "Response valid and meets confidence threshold.",
    };
  }

  /**
   * Memory stage writing execution event log to database.
   */
  protected async remember(ctx: AgentContext<TInput>): Promise<void> {
    await this.memoryManager.logExecutionEvent(ctx.projectId, {
      actorName: this.name,
      title: `Agent Execution Completed: ${this.name}`,
      description: `Executed agent for goal: ${ctx.goal}. Execution ID: ${ctx.executionId}`,
      metadata: {
        executionId: ctx.executionId,
        durationMs: Date.now() - ctx.startTime,
        logsCount: ctx.logs.length,
      },
    });
  }
}
