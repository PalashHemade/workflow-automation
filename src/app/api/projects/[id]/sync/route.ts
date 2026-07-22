import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { runIncrementalSync } from "@/lib/syncEngine";
import { syncJiraProject } from "@/lib/jiraSync";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const project = await db.engineeringProject.findUnique({
      where: { id: params.id },
      include: { integrations: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Engineering Project not found" }, { status: 404 });
    }

    // Update project sync status
    await db.engineeringProject.update({
      where: { id: project.id },
      data: { syncStatus: "SYNCING" },
    });

    // 1. Sync GitHub repository
    if (project.repositoryId) {
      await runIncrementalSync(project.repositoryId, "manual");
    }

    // 2. Sync Jira if integrated
    const jiraIntegration = project.integrations.find((i) => i.provider === "JIRA");
    if (jiraIntegration) {
      const config = (jiraIntegration.config as any) || {};
      await syncJiraProject({
        projectId: project.id,
        projectKey: config.projectKey,
        cloudId: config.cloudId,
      });
    }

    await db.engineeringProject.update({
      where: { id: project.id },
      data: { syncStatus: "SUCCESS", lastSyncAt: new Date() },
    });

    return NextResponse.json({ success: true, message: "Project synchronization completed" });
  } catch (error: any) {
    await db.engineeringProject.update({
      where: { id: params.id },
      data: { syncStatus: "FAILED" },
    });
    return NextResponse.json({ error: error.message || "Project sync failed" }, { status: 500 });
  }
}
