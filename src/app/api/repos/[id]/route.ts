import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchGitHub } from "@/lib/github";

export const dynamic = "force-dynamic";

/**
 * Helper to delete a webhook from GitHub
 */
async function deleteGitHubWebhook(
  repositoryId: string,
  owner: string,
  name: string,
  githubWebhookId: bigint,
  accessToken: string
) {
  try {
    console.log(`Attempting to delete GitHub webhook ${githubWebhookId} for ${owner}/${name}...`);
    const response = await fetchGitHub(
      `https://api.github.com/repos/${owner}/${name}/hooks/${githubWebhookId}`,
      accessToken,
      { method: "DELETE" }
    );

    if (response.ok || response.status === 404) {
      console.log(`GitHub webhook ${githubWebhookId} deleted successfully (or already deleted).`);
    } else {
      const errText = await response.text();
      console.warn(`Failed to delete webhook from GitHub: ${errText}`);
    }

    // Inactivate in our DB in either case
    await db.repositoryWebhook.update({
      where: { repositoryId },
      data: {
        isActive: false,
        status: "inactive",
      },
    });

    await db.repository.update({
      where: { id: repositoryId },
      data: {
        webhookEnabled: false,
      },
    });
  } catch (err) {
    console.error(`Error deleting webhook from GitHub:`, err);
  }
}

/**
 * PATCH: Update repository settings (display name, archive, tracking status, polling interval)
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const repositoryId = params.id;
    const body = await req.json();
    const { displayName, isArchived, isTracked, pollingInterval } = body;

    const repository = await db.repository.findUnique({
      where: { id: repositoryId },
      include: { webhook: true, user: { include: { accounts: true } } },
    });

    if (!repository) {
      return NextResponse.json({ error: "Repository not found" }, { status: 404 });
    }

    if (repository.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const githubAccount = repository.user.accounts.find((acc) => acc.provider === "github");
    const accessToken = githubAccount?.access_token || "";

    const updateData: any = {};
    if (displayName !== undefined) updateData.displayName = displayName;
    if (isArchived !== undefined) updateData.isArchived = isArchived;
    if (isTracked !== undefined) updateData.isTracked = isTracked;
    if (pollingInterval !== undefined) updateData.pollingInterval = Number(pollingInterval);

    // If tracking is disabled, or repo is archived, delete GitHub Webhook automatically
    if (
      ((isTracked === false && repository.isTracked) || (isArchived === true && !repository.isArchived)) &&
      repository.webhook?.githubWebhookId &&
      repository.webhook.isActive
    ) {
      await deleteGitHubWebhook(
        repositoryId,
        repository.owner,
        repository.name,
        repository.webhook.githubWebhookId,
        accessToken
      );
    }

    const updatedRepo = await db.repository.update({
      where: { id: repositoryId },
      data: updateData,
      include: { webhook: true },
    });

    return NextResponse.json({
      success: true,
      repository: {
        ...updatedRepo,
        githubId: updatedRepo.githubId.toString(),
        webhook: updatedRepo.webhook
          ? {
              ...updatedRepo.webhook,
              githubWebhookId: updatedRepo.webhook.githubWebhookId?.toString() || null,
            }
          : null,
      },
    });
  } catch (error: any) {
    console.error("PATCH repo settings error:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}

/**
 * DELETE: Permanently delete a repository and all related records
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const repositoryId = params.id;

    const repository = await db.repository.findUnique({
      where: { id: repositoryId },
      include: { webhook: true, user: { include: { accounts: true } } },
    });

    if (!repository) {
      return NextResponse.json({ error: "Repository not found" }, { status: 404 });
    }

    if (repository.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const githubAccount = repository.user.accounts.find((acc) => acc.provider === "github");
    const accessToken = githubAccount?.access_token || "";

    // 1. Automatically delete remote webhook if it exists on GitHub
    if (repository.webhook?.githubWebhookId && repository.webhook.isActive) {
      await deleteGitHubWebhook(
        repositoryId,
        repository.owner,
        repository.name,
        repository.webhook.githubWebhookId,
        accessToken
      );
    }

    // 2. Cascade delete repository record (Prisma will automatically cascade delete commits, PRs, etc.)
    await db.repository.delete({
      where: { id: repositoryId },
    });

    return NextResponse.json({
      success: true,
      message: "Repository and all associated database records deleted successfully.",
    });
  } catch (error: any) {
    console.error("DELETE repo error:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}
