import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";

// Force Node.js runtime to read raw request body bytes for crypto verification
export const dynamic = "force-dynamic";

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;

/**
 * Helper to verify GitHub Webhook cryptographic signature (HMAC-SHA256)
 */
function verifySignature(signature: string | null, payload: string): boolean {
  if (!signature || !WEBHOOK_SECRET) {
    return false;
  }

  try {
    const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
    const digest = "sha256=" + hmac.update(payload).digest("hex");
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, "utf-8"),
      Buffer.from(digest, "utf-8")
    );
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-hub-signature-256");
  const event = req.headers.get("x-github-event");
  const rawBody = await req.text();

  // 1. Verify the signature to ensure request comes from GitHub
  if (!verifySignature(signature, rawBody)) {
    return NextResponse.json(
      { error: "Invalid cryptographic signature" },
      { status: 401 }
    );
  }

  const payload = JSON.parse(rawBody);

  try {
    // 2. Handle Ping event
    if (event === "ping") {
      return NextResponse.json({ message: "pong" });
    }

    const githubRepoId = BigInt(payload.repository?.id);
    if (!githubRepoId) {
      return NextResponse.json({ error: "Missing repository information" }, { status: 400 });
    }

    // 3. Find the tracked repository in our DB
    const repository = await db.repository.findUnique({
      where: { githubId: githubRepoId },
    });

    if (!repository || !repository.isTracked) {
      return NextResponse.json(
        { message: "Repository is not currently tracked by any user, event ignored." },
        { status: 200 }
      );
    }

    // 4. Handle PUSH Events
    if (event === "push") {
      const commits = payload.commits || [];
      const newCommitsCount = commits.length;

      for (const commitPayload of commits) {
        const sha = commitPayload.id;
        const authorUsername = commitPayload.author?.username;
        const authorEmail = commitPayload.author?.email || "";
        const authorName = commitPayload.author?.name || "";

        let contributorId: string | null = null;

        // Try to associate with a Contributor if a username is present
        if (authorUsername) {
          const contributor = await db.contributor.upsert({
            where: { login: authorUsername },
            update: {
              email: authorEmail,
              name: authorName,
            },
            create: {
              login: authorUsername,
              email: authorEmail,
              name: authorName,
            },
          });
          contributorId = contributor.id;
        }

        // Upsert commit to prevent duplicates if webhook delivers the same event again
        await db.commit.upsert({
          where: { sha },
          update: {
            message: commitPayload.message,
            url: commitPayload.url,
            committedAt: new Date(commitPayload.timestamp),
            authorName,
            authorEmail,
            contributorId,
          },
          create: {
            sha,
            message: commitPayload.message,
            url: commitPayload.url,
            committedAt: new Date(commitPayload.timestamp),
            repositoryId: repository.id,
            authorName,
            authorEmail,
            contributorId,
          },
        });
      }

      return NextResponse.json({
        success: true,
        event: "push",
        processed: newCommitsCount,
      });
    }

    // 5. Handle PULL REQUEST Events
    if (event === "pull_request") {
      const prPayload = payload.pull_request;
      if (!prPayload) {
        return NextResponse.json({ error: "No pull request data" }, { status: 400 });
      }

      const prGithubId = BigInt(prPayload.id);
      const prNumber = prPayload.number;
      const title = prPayload.title;
      const state = prPayload.state; // open, closed
      const url = prPayload.html_url;
      const createdAt = new Date(prPayload.created_at);
      const updatedAt = new Date(prPayload.updated_at);
      const closedAt = prPayload.closed_at ? new Date(prPayload.closed_at) : null;
      const mergedAt = prPayload.merged_at ? new Date(prPayload.merged_at) : null;
      const merged = !!prPayload.merged;

      const senderLogin = prPayload.user?.login;
      const senderGithubId = prPayload.user?.id ? BigInt(prPayload.user.id) : null;
      const senderAvatarUrl = prPayload.user?.avatar_url;

      let contributorId: string | null = null;

      if (senderLogin) {
        const contributor = await db.contributor.upsert({
          where: { login: senderLogin },
          update: {
            githubId: senderGithubId,
            avatarUrl: senderAvatarUrl,
          },
          create: {
            login: senderLogin,
            githubId: senderGithubId,
            avatarUrl: senderAvatarUrl,
          },
        });
        contributorId = contributor.id;
      }

      // Upsert the Pull Request (resolving conflicts by githubId unique constraint)
      await db.pullRequest.upsert({
        where: { githubId: prGithubId },
        update: {
          number: prNumber,
          title,
          state,
          url,
          updatedAt,
          closedAt,
          mergedAt,
          merged,
          authorName: senderLogin || "unknown",
          authorEmail: "",
          authorAvatar: senderAvatarUrl || null,
          contributorId,
        },
        create: {
          githubId: prGithubId,
          number: prNumber,
          title,
          state,
          url,
          createdAt,
          updatedAt,
          closedAt,
          mergedAt,
          merged,
          repositoryId: repository.id,
          authorName: senderLogin || "unknown",
          authorEmail: "",
          authorAvatar: senderAvatarUrl || null,
          contributorId,
        },
      });

      return NextResponse.json({
        success: true,
        event: "pull_request",
        action: payload.action,
        prNumber,
      });
    }

    return NextResponse.json({ message: `Event '${event}' received but not processed` }, { status: 200 });
  } catch (error: any) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}
