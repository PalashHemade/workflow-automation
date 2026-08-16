import { NextRequest, NextResponse } from "next/server";
import { AgentOrchestrator } from "@/agents/orchestrator/AgentOrchestrator";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, agents } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required in request body" },
        { status: 400 }
      );
    }

    const orchestrator = new AgentOrchestrator();
    const agentList = Array.isArray(agents) && agents.length > 0 ? agents : ["SummaryAgent", "SprintHealthAgent"];

    const results = await orchestrator.runWorkflow(projectId, agentList);

    return NextResponse.json({
      success: results.every((r) => r.success),
      projectId,
      executedAgents: results.map((r) => r.agentName),
      results,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to execute agent workflow" },
      { status: 500 }
    );
  }
}
