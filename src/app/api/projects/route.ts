import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listEngineeringProjects, createEngineeringProject } from "@/lib/projectService";

export const dynamic = "force-dynamic";

function safeJsonResponse(data: any, status = 200) {
  return new NextResponse(
    JSON.stringify(data, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
    {
      status,
      headers: { "Content-Type": "application/json" },
    }
  );
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projects = await listEngineeringProjects(session.user.id);
    return safeJsonResponse({ projects });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch projects" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      description,
      repositoryId,
      primaryBranch,
      jiraWorkspaceId,
      jiraProjectKey,
      jiraCloudId,
      jiraAccessToken,
      jiraRefreshToken,
    } = body;

    if (!name || !repositoryId) {
      return NextResponse.json({ error: "Project name and repositoryId are required" }, { status: 400 });
    }

    const project = await createEngineeringProject({
      name,
      description,
      ownerId: session.user.id,
      repositoryId,
      primaryBranch,
      jiraWorkspaceId,
      jiraProjectKey,
      jiraCloudId,
      jiraAccessToken,
      jiraRefreshToken,
    });

    return safeJsonResponse({ project }, 201);
  } catch (error: any) {
    console.error("Error creating engineering project:", error);
    return NextResponse.json({ error: error.message || "Failed to create project" }, { status: 500 });
  }
}


