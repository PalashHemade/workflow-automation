import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runIncrementalSync } from "@/lib/syncEngine";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { repositoryId, syncDepth = "incremental" } = body;

    if (!repositoryId) {
      return NextResponse.json({ error: "Missing repositoryId" }, { status: 400 });
    }

    // 2. Fetch the target repository from the DB
    const repository = await db.repository.findUnique({
      where: { id: repositoryId },
      include: { webhook: true, user: { include: { accounts: true } } },
    });

    if (!repository) {
      return NextResponse.json({ error: "Repository not found" }, { status: 404 });
    }

    // Ensure the current user has access to track/sync this repository
    if (repository.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { owner, name } = repository;

    // Get the user's GitHub OAuth access token
    const githubAccount = repository.user.accounts.find(
      (acc) => acc.provider === "github"
    );
    const accessToken = githubAccount?.access_token;
    if (!accessToken) {
      return NextResponse.json(
        { error: "GitHub OAuth token not found for user" },
        { status: 400 }
      );
    }

    // 3. Attempt Webhook Registration if not already registered and active
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    const appUrl = process.env.APP_URL;

    // If webhook is not present, or does not have a githubWebhookId, and secret/appUrl are available
    if (
      (!repository.webhook || !repository.webhook.githubWebhookId || !repository.webhook.isActive) &&
      webhookSecret &&
      appUrl
    ) {
      try {
        console.log(`Registering webhook for ${owner}/${name} on GitHub...`);
        const webhookUrl = `${appUrl}/api/webhooks/github`;
        const webhookHeaders = {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "github-analytics-dashboard",
          "Content-Type": "application/json",
        };

        const webhookResponse = await fetch(
          `https://api.github.com/repos/${owner}/${name}/hooks`,
          {
            method: "POST",
            headers: webhookHeaders,
            body: JSON.stringify({
              name: "web",
              active: true,
              events: [
                "push",
                "pull_request",
                "pull_request_review",
                "pull_request_review_comment",
                "create",
                "delete",
              ],
              config: {
                url: webhookUrl,
                content_type: "json",
                secret: webhookSecret,
                insecure_ssl: "0",
              },
            }),
          }
        );

        if (webhookResponse.ok) {
          const hookData = await webhookResponse.json();
          await db.repositoryWebhook.upsert({
            where: { repositoryId: repository.id },
            update: {
              githubWebhookId: BigInt(hookData.id),
              status: "active",
              isActive: true,
              lastDeliveryAttempt: new Date(),
              lastSuccessfulDelivery: new Date(),
            },
            create: {
              repositoryId: repository.id,
              githubWebhookId: BigInt(hookData.id),
              status: "active",
              isActive: true,
              lastDeliveryAttempt: new Date(),
              lastSuccessfulDelivery: new Date(),
            },
          });
          // Also set webhookEnabled = true in core repository table
          await db.repository.update({
            where: { id: repository.id },
            data: { webhookEnabled: true },
          });
          console.log(`Successfully registered webhook (ID: ${hookData.id}) on GitHub.`);
        } else {
          const webhookErrText = await webhookResponse.text();
          console.warn(
            `Failed to register webhook. Status: ${webhookResponse.status}. Details: ${webhookErrText}`
          );
        }
      } catch (err) {
        console.warn("Error creating webhook on GitHub (might be an external repository):", err);
      }
    }

    // Set isTracked to true upon triggering synchronization
    if (!repository.isTracked) {
      await db.repository.update({
        where: { id: repositoryId },
        data: { isTracked: true },
      });
    }

    // 4. Trigger the incremental sync engine asynchronously to prevent HTTP gateway timeouts
    const maxPages = syncDepth === "full" ? 15 : 10;
    runIncrementalSync(repositoryId, "manual", maxPages).catch((err) => {
      console.error(`Asynchronous incremental sync failed for repo ${repositoryId}:`, err);
    });

    return NextResponse.json({
      success: true,
      message: "Incremental synchronization started in background.",
    });
  } catch (error: any) {
    console.error("Sync API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
