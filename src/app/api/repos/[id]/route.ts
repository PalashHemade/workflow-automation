import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { getServerSession } from "next-auth";
import { authOptions, checkRepositoryAccess } from "@/lib/auth/auth";
import { fetchGitHub } from "@/lib/github/github";
import { getValidGithubAccessToken } from "@/lib/auth/githubTokenService";
import { createLogger } from "@/lib/core/logger";

const log = createLogger("RepoSettings");

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
    log.info("Attempting to delete GitHub webhook %s for %s/%s...", githubWebhookId, owner, name);
    const response = await fetchGitHub(
      `https://api.github.com/repos/${owner}/${name}/hooks/${githubWebhookId}`,
      accessToken,
      { method: "DELETE" }
    );

    if (response.ok || response.status === 404) {
      log.success("GitHub webhook %s deleted (or already deleted)", githubWebhookId);
    } else {
      const errText = await response.text();
      log.warn("Failed to delete webhook from GitHub: %s", errText);
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
  } catch (err: any) {
    log.error("Error deleting webhook from GitHub: %s", err?.message ?? err);
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

    const repository = await checkRepositoryAccess(repositoryId, session.user.id);

    if (!repository) {
      return NextResponse.json({ error: "Forbidden or Repository not found" }, { status: 403 });
    }


    let accessToken = "";
    try {
      accessToken = await getValidGithubAccessToken(repository.userId);
    } catch (err: any) {
      log.warn("No usable GitHub token for user %s while updating repo %s: %s", repository.userId, repositoryId, err?.message ?? err);
    }

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
    log.error("PATCH repo settings error: %s", error?.message ?? error);
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

    const repository = await checkRepositoryAccess(repositoryId, session.user.id);

    if (!repository) {
      return NextResponse.json({ error: "Forbidden or Repository not found" }, { status: 403 });
    }


    let accessToken = "";
    try {
      accessToken = await getValidGithubAccessToken(repository.userId);
    } catch (err: any) {
      log.warn("No usable GitHub token for user %s while deleting repo %s: %s", repository.userId, repositoryId, err?.message ?? err);
    }

    const currentUserId = session.user.id;
    const trackers = repository.trackingUserIds
      ? repository.trackingUserIds.split(",").filter((id: string) => id.trim() !== "")
      : [];

    const isPrimaryOwner = repository.userId === currentUserId;
    const isObserver = trackers.includes(currentUserId);

    if (isPrimaryOwner) {
      if (trackers.length > 0) {
        // Transfer primary ownership to the first observer
        const nextOwnerId = trackers[0];
        const remainingTrackers = trackers.slice(1);
        const newTrackersString = remainingTrackers.length > 0
          ? `,${remainingTrackers.join(",")},`
          : "";

        await db.repository.update({
          where: { id: repositoryId },
          data: {
            userId: nextOwnerId,
            trackingUserIds: newTrackersString,
          },
        });

        return NextResponse.json({
          success: true,
          message: "Repository untracked from your workspace. Active tracking transferred to other members.",
        });
      }
    } else if (isObserver) {
      // Just remove the user from the trackers list
      const remainingTrackers = trackers.filter((id: string) => id !== currentUserId);
      const newTrackersString = remainingTrackers.length > 0
        ? `,${remainingTrackers.join(",")},`
        : "";

      await db.repository.update({
        where: { id: repositoryId },
        data: {
          trackingUserIds: newTrackersString,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Repository untracked from your workspace.",
      });
    }

    // Default: No other trackers remain, delete completely
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

    // 2. Cascade delete repository record
    await db.repository.delete({
      where: { id: repositoryId },
    });

    return NextResponse.json({
      success: true,
      message: "Repository and all associated database records deleted successfully.",
    });
  } catch (error: any) {
    log.error("DELETE repo error: %s", error?.message ?? error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}
