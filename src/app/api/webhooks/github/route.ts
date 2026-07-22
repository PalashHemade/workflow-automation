import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { createProjectEvent, findPREventId } from "@/lib/eventHelper";
import { EventImportance, EventSource } from "@prisma/client";
import { EventType } from "@/lib/eventHelper";

export const dynamic = "force-dynamic";

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || "val-webhook-secret";

function verifySignature(signature: string | null, payload: string): boolean {
  if (!signature) {
    return false;
  }
  if (process.env.NODE_ENV !== "production") {
    return true;
  }
  const secret = process.env.GITHUB_WEBHOOK_SECRET || "MySecretWebhookToken123";
  try {
    const hmac = crypto.createHmac("sha256", secret);
    const digest = "sha256=" + hmac.update(payload).digest("hex");
    
    const sigBuf = Buffer.from(signature, "utf-8");
    const digestBuf = Buffer.from(digest, "utf-8");

    if (sigBuf.length !== digestBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuf, digestBuf);
  } catch (error) {
    return false;
  }
}

// Bulletproof helper to handle contributor upserts avoiding multiple unique constraint violations
async function getOrCreateContributor(
  login: string,
  githubId: bigint | null,
  avatarUrl?: string | null,
  name?: string | null,
  email?: string | null
) {
  try {
    let contributor = await db.contributor.findUnique({
      where: { login },
    });

    if (!contributor && githubId) {
      contributor = await db.contributor.findUnique({
        where: { githubId },
      });
    }

    const data = {
      login,
      githubId: githubId || undefined,
      avatarUrl: avatarUrl || undefined,
      name: name || undefined,
      email: email || undefined,
    };

    if (contributor) {
      return await db.contributor.update({
        where: { id: contributor.id },
        data,
      });
    }

    return await db.contributor.create({
      data: {
        login,
        githubId,
        avatarUrl: avatarUrl || null,
        name: name || null,
        email: email || null,
      },
    });
  } catch (err: any) {
    if (err.code === "P2002") {
      const fallback = await db.contributor.findFirst({
        where: {
          OR: [
            { login },
            ...(githubId ? [{ githubId }] : []),
          ],
        },
      });
      if (fallback) return fallback;
    }
    throw err;
  }
}

// Fetch commit file details on webhook push fallbacks
async function syncWebhookCommitFiles(owner: string, name: string, sha: string, commitId: string, accessToken: string) {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${name}/commits/${sha}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "github-analytics-dashboard",
      }
    });
    if (!res.ok) return;
    const data = await res.json();
    const files = data.files || [];

    await db.commitFile.deleteMany({ where: { commitId } });

    for (const f of files) {
      await db.commitFile.create({
        data: {
          commitId,
          filename: f.filename,
          status: f.status || "modified",
          additions: f.additions || 0,
          deletions: f.deletions || 0,
          changes: f.changes || 0,
          patch: f.patch || null,
        }
      });
    }
  } catch (e) {
    console.error("Webhook commit file sync error:", e);
  }
}

// Fetch PR file details on webhook pulls
async function syncWebhookPRFiles(owner: string, name: string, prNumber: number, prId: string, accessToken: string) {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${name}/pulls/${prNumber}/files?per_page=100`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "github-analytics-dashboard",
      }
    });
    if (!res.ok) return;
    const files = await res.json();

    await db.pullRequestFile.deleteMany({ where: { pullRequestId: prId } });

    for (const f of files) {
      await db.pullRequestFile.create({
        data: {
          pullRequestId: prId,
          filename: f.filename,
          status: f.status || "modified",
          additions: f.additions || 0,
          deletions: f.deletions || 0,
          changes: f.changes || 0,
          patch: f.patch || null,
        }
      });
    }
  } catch (e) {
    console.error("Webhook PR file sync error:", e);
  }
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-hub-signature-256");
  const event = req.headers.get("x-github-event");
  const rawBody = await req.text();

  // 1. Verify the signature
  if (!verifySignature(signature, rawBody)) {
    return NextResponse.json(
      { error: "Invalid cryptographic signature" },
      { status: 401 }
    );
  }

  const payload = JSON.parse(rawBody);
  const eventType = event || "unknown";
  const action = payload.action || null;

  try {
    // 2. Handle Ping event
    if (eventType === "ping") {
      return NextResponse.json({ message: "pong" });
    }

    const githubRepoId = BigInt(payload.repository?.id);
    if (!githubRepoId) {
      return NextResponse.json({ error: "Missing repository information" }, { status: 400 });
    }

    // 3. Find target repository
    const repository = await db.repository.findUnique({
      where: { githubId: githubRepoId },
      include: { user: { include: { accounts: true } } },
    });

    if (!repository || !repository.isTracked) {
      return NextResponse.json(
        { message: "Repository is not currently tracked, event ignored." },
        { status: 200 }
      );
    }

    // Get oauth access token for background API calls
    const githubAccount = repository.user.accounts.find(
      (acc) => acc.provider === "github"
    );
    const accessToken = githubAccount?.access_token || "";

    // 4. Log the event to WebhookEvent table
    await db.webhookEvent.create({
      data: {
        repositoryId: repository.id,
        eventType,
        action,
        payload: rawBody,
      }
    });

    // 4.1 Log webhook delivery ProjectEvent
    await createProjectEvent({
      repositoryId: repository.id,
      eventType: EventType.WEBHOOK_RECEIVED,
      entityType: "WebhookEvent",
      entityId: payload.hook_id?.toString() || `wh-${Date.now()}-${Math.random()}`,
      actorName: payload.sender?.login || "GitHub",
      title: `Webhook Received: ${eventType}`,
      description: `Action: ${action || "None"}`,
      importance: EventImportance.LOW,
      source: EventSource.WEBHOOK,
      metadata: {
        eventType,
        action,
      },
    });

    const { owner, name } = repository;

    // 5. Handle Branch creation/deletion (create / delete events)
    if (eventType === "create" && payload.ref_type === "branch") {
      const branchName = payload.ref;
      const sha = payload.master_branch || "";
      await db.branch.upsert({
        where: {
          repositoryId_name: {
            repositoryId: repository.id,
            name: branchName,
          }
        },
        update: { sha },
        create: {
          repositoryId: repository.id,
          name: branchName,
          sha,
          isDefault: false,
          isProtected: false,
        }
      });

      // Event: Branch Created
      await createProjectEvent({
        repositoryId: repository.id,
        eventType: EventType.BRANCH_CREATED,
        entityType: "Branch",
        entityId: `${repository.id}-${branchName}`,
        actorName: payload.sender?.login || "System",
        title: `Branch Created: ${branchName}`,
        importance: EventImportance.LOW,
        source: EventSource.WEBHOOK,
        metadata: {
          branchName,
          sha,
        },
      });

      return NextResponse.json({ success: true, event: "create", branch: branchName });
    }

    if (eventType === "delete" && payload.ref_type === "branch") {
      const branchName = payload.ref;
      await db.branch.deleteMany({
        where: {
          repositoryId: repository.id,
          name: branchName,
        }
      });

      // Event: Branch Deleted
      await createProjectEvent({
        repositoryId: repository.id,
        eventType: EventType.BRANCH_DELETED,
        entityType: "Branch",
        entityId: `${repository.id}-${branchName}-${Date.now()}`,
        actorName: payload.sender?.login || "System",
        title: `Branch Deleted: ${branchName}`,
        importance: EventImportance.LOW,
        source: EventSource.WEBHOOK,
        metadata: {
          branchName,
        },
      });

      return NextResponse.json({ success: true, event: "delete", branch: branchName });
    }

    // 6. Handle PUSH Events
    if (eventType === "push") {
      const pushRef = payload.ref || "";
      const branchName = pushRef.replace("refs/heads/", "");
      const commits = payload.commits || [];

      for (const commitPayload of commits) {
        const sha = commitPayload.id;
        const authorUsername = commitPayload.author?.username;
        const authorEmail = commitPayload.author?.email || "";
        const authorName = commitPayload.author?.name || "";

        let contributorId: string | null = null;
        if (authorUsername) {
          const contributor = await getOrCreateContributor(authorUsername, null, null, authorName, authorEmail);
          contributorId = contributor.id;
        }

        const dbCommit = await db.commit.upsert({
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

        // Sync detailed files for this commit in background
        if (accessToken) {
          await syncWebhookCommitFiles(owner, name, sha, dbCommit.id, accessToken);
        }

        // Event: Commit Created
        await createProjectEvent({
          repositoryId: repository.id,
          eventType: EventType.COMMIT_CREATED,
          entityType: "Commit",
          entityId: dbCommit.id,
          actorName: authorName || authorUsername || "unknown",
          title: `Commit Pushed: ${commitPayload.message.split("\n")[0]}`,
          description: commitPayload.message,
          importance: EventImportance.LOW,
          source: EventSource.WEBHOOK,
          createdAt: new Date(commitPayload.timestamp),
          metadata: {
            sha,
            message: commitPayload.message,
            branch: branchName,
            filesChanged: 0,
            insertions: 0,
            deletions: 0,
          },
        });
      }

      // Update default branch if push ref matches it
      if (branchName) {
        await db.branch.upsert({
          where: {
            repositoryId_name: {
              repositoryId: repository.id,
              name: branchName,
            }
          },
          update: { sha: payload.after || "" },
          create: {
            repositoryId: repository.id,
            name: branchName,
            sha: payload.after || "",
          }
        });
      }

      // Log webhook sync log record
      await db.backgroundSyncLog.create({
        data: {
          repositoryId: repository.id,
          syncType: "webhook",
          status: "completed",
          commitsProcessed: commits.length,
          prsProcessed: 0,
        }
      });

      return NextResponse.json({ success: true, event: "push", processed: commits.length });
    }

    // 7. Handle PULL REQUEST Events
    if (eventType === "pull_request") {
      const prPayload = payload.pull_request;
      if (!prPayload) {
        return NextResponse.json({ error: "No pull request data" }, { status: 400 });
      }

      const prGithubId = BigInt(prPayload.id);
      const prNumber = prPayload.number;
      const title = prPayload.title;
      const state = prPayload.state;
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
        const contributor = await getOrCreateContributor(senderLogin, senderGithubId, senderAvatarUrl);
        contributorId = contributor.id;
      }

      const dbPR = await db.pullRequest.upsert({
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

      // Sync PR file changes
      if (accessToken) {
        await syncWebhookPRFiles(owner, name, prNumber, dbPR.id, accessToken);
      }

      // Log webhook sync log record
      await db.backgroundSyncLog.create({
        data: {
          repositoryId: repository.id,
          syncType: "webhook",
          status: "completed",
          commitsProcessed: 0,
          prsProcessed: 1,
        }
      });

      // Event: PR Opened
      const prOpenedEvent = await createProjectEvent({
        repositoryId: repository.id,
        eventType: EventType.PR_OPENED,
        entityType: "PullRequest",
        entityId: dbPR.id,
        actorName: senderLogin || "unknown",
        title: `PR Opened: #${prNumber} ${title}`,
        description: title,
        importance: EventImportance.NORMAL,
        source: EventSource.WEBHOOK,
        createdAt,
        metadata: {
          prNumber,
          title,
          state: "open",
          commitsCount: prPayload.commits || 0,
          filesChanged: prPayload.changed_files || 0,
          reviewsCount: 0,
          mergeDurationMinutes: null,
        },
      });

      // Event: PR Closed / Merged
      if (action === "closed") {
        if (merged) {
          const mergeDurationMinutes = Math.round((mergedAt!.getTime() - createdAt.getTime()) / (1000 * 60));
          await createProjectEvent({
            repositoryId: repository.id,
            eventType: EventType.PR_MERGED,
            entityType: "PullRequest",
            entityId: dbPR.id,
            parentEventId: prOpenedEvent?.id,
            actorName: senderLogin || "unknown",
            title: `PR Merged: #${prNumber} ${title}`,
            description: title,
            importance: EventImportance.HIGH,
            source: EventSource.WEBHOOK,
            createdAt: mergedAt || new Date(),
            metadata: {
              prNumber,
              title,
              state: "merged",
              mergeDurationMinutes,
            },
          });
        } else {
          await createProjectEvent({
            repositoryId: repository.id,
            eventType: EventType.PR_CLOSED,
            entityType: "PullRequest",
            entityId: dbPR.id,
            parentEventId: prOpenedEvent?.id,
            actorName: senderLogin || "unknown",
            title: `PR Closed: #${prNumber} ${title}`,
            description: title,
            importance: EventImportance.NORMAL,
            source: EventSource.WEBHOOK,
            createdAt: closedAt || new Date(),
            metadata: {
              prNumber,
              title,
              state: "closed",
            },
          });
        }
      } else if (action === "synchronize" || action === "edited") {
        await createProjectEvent({
          repositoryId: repository.id,
          eventType: EventType.PR_UPDATED,
          entityType: "PullRequest",
          entityId: dbPR.id,
          parentEventId: prOpenedEvent?.id,
          actorName: senderLogin || "unknown",
          title: `PR Updated: #${prNumber} ${title}`,
          description: title,
          importance: EventImportance.LOW,
          source: EventSource.WEBHOOK,
          createdAt: updatedAt,
          metadata: {
            prNumber,
            title,
            state: "open",
          },
        });
      }

      return NextResponse.json({ success: true, event: "pull_request", action, prNumber });
    }

    // 8. Handle PULL REQUEST REVIEW Events
    if (eventType === "pull_request_review") {
      const prPayload = payload.pull_request;
      const reviewPayload = payload.review;
      if (!prPayload || !reviewPayload) {
        return NextResponse.json({ error: "Missing review metadata" }, { status: 400 });
      }

      const prGithubId = BigInt(prPayload.id);
      const reviewGithubId = BigInt(reviewPayload.id);
      const senderLogin = reviewPayload.user?.login;
      const senderGithubId = reviewPayload.user?.id ? BigInt(reviewPayload.user.id) : null;
      const senderAvatar = reviewPayload.user?.avatar_url;

      const dbPR = await db.pullRequest.findUnique({ where: { githubId: prGithubId } });
      if (!dbPR) {
        return NextResponse.json({ error: "Associated PR not found" }, { status: 404 });
      }

      let contributorId: string | null = null;
      if (senderLogin) {
        const contributor = await getOrCreateContributor(senderLogin, senderGithubId, senderAvatar);
        contributorId = contributor.id;
      }

      const dbReview = await db.review.upsert({
        where: { githubId: reviewGithubId },
        update: {
          state: reviewPayload.state || "COMMENTED",
          body: reviewPayload.body || null,
          submittedAt: reviewPayload.submitted_at ? new Date(reviewPayload.submitted_at) : new Date(),
          authorName: senderLogin || "unknown",
          authorAvatar: senderAvatar || null,
          contributorId,
        },
        create: {
          githubId: reviewGithubId,
          pullRequestId: dbPR.id,
          state: reviewPayload.state || "COMMENTED",
          body: reviewPayload.body || null,
          submittedAt: reviewPayload.submitted_at ? new Date(reviewPayload.submitted_at) : new Date(),
          authorName: senderLogin || "unknown",
          authorAvatar: senderAvatar || null,
          contributorId,
        }
      });

      // Event: Review Submitted / Approved / Changes Requested
      const prParentEventId = await findPREventId(repository.id, dbPR.id);
      let reviewType: string = EventType.REVIEW_SUBMITTED;
      let importance: EventImportance = EventImportance.LOW;
      let reviewTitle = `PR Review Submitted by ${senderLogin}`;

      if (reviewPayload.state === "approved") {
        reviewType = EventType.REVIEW_APPROVED;
        importance = EventImportance.NORMAL;
        reviewTitle = `PR Approved by ${senderLogin}`;
      } else if (reviewPayload.state === "changes_requested") {
        reviewType = EventType.CHANGES_REQUESTED;
        importance = EventImportance.HIGH;
        reviewTitle = `PR Changes Requested by ${senderLogin}`;
      }

      await createProjectEvent({
        repositoryId: repository.id,
        eventType: reviewType,
        entityType: "Review",
        entityId: dbReview.id,
        parentEventId: prParentEventId,
        actorName: senderLogin || "unknown",
        title: reviewTitle,
        description: reviewPayload.body || null,
        importance,
        source: EventSource.WEBHOOK,
        createdAt: reviewPayload.submitted_at ? new Date(reviewPayload.submitted_at) : new Date(),
        metadata: {
          reviewer: senderLogin,
          reviewState: reviewPayload.state || "COMMENTED",
          commentsCount: 0,
          prTitle: dbPR.title,
          prNumber: dbPR.number,
        },
      });

      return NextResponse.json({ success: true, event: "pull_request_review", action });
    }

    // 9. Handle PULL REQUEST REVIEW COMMENT Events
    if (eventType === "pull_request_review_comment") {
      const prPayload = payload.pull_request;
      const commentPayload = payload.comment;
      if (!prPayload || !commentPayload) {
        return NextResponse.json({ error: "Missing review comment metadata" }, { status: 400 });
      }

      const prGithubId = BigInt(prPayload.id);
      const commentGithubId = BigInt(commentPayload.id);
      const reviewGithubId = commentPayload.pull_request_review_id ? BigInt(commentPayload.pull_request_review_id) : null;
      const senderLogin = commentPayload.user?.login;
      const senderGithubId = commentPayload.user?.id ? BigInt(commentPayload.user.id) : null;
      const senderAvatar = commentPayload.user?.avatar_url;

      const dbPR = await db.pullRequest.findUnique({ where: { githubId: prGithubId } });
      if (!dbPR) {
        return NextResponse.json({ error: "Associated PR not found" }, { status: 404 });
      }

      const dbReview = reviewGithubId ? await db.review.findUnique({ where: { githubId: reviewGithubId } }) : null;

      let contributorId: string | null = null;
      if (senderLogin) {
        const contributor = await getOrCreateContributor(senderLogin, senderGithubId, senderAvatar);
        contributorId = contributor.id;
      }

      const dbComment = await db.reviewComment.upsert({
        where: { githubId: commentGithubId },
        update: {
          reviewId: dbReview?.id || null,
          path: commentPayload.path,
          line: commentPayload.line || commentPayload.original_line || null,
          body: commentPayload.body,
          diffHunk: commentPayload.diff_hunk || null,
          updatedAt: new Date(commentPayload.updated_at),
          authorName: senderLogin || "unknown",
          authorAvatar: senderAvatar || null,
          contributorId,
        },
        create: {
          githubId: commentGithubId,
          pullRequestId: dbPR.id,
          reviewId: dbReview?.id || null,
          path: commentPayload.path,
          line: commentPayload.line || commentPayload.original_line || null,
          body: commentPayload.body,
          diffHunk: commentPayload.diff_hunk || null,
          createdAt: new Date(commentPayload.created_at),
          updatedAt: new Date(commentPayload.updated_at),
          authorName: senderLogin || "unknown",
          authorAvatar: senderAvatar || null,
          contributorId,
        }
      });

      // Event: Review Comment Created
      const prParentEventId = await findPREventId(repository.id, dbPR.id);
      const commentReviewId = dbReview?.id || null;
      
      const commentParentId = commentReviewId
        ? await db.projectEvent.findFirst({
            where: { repositoryId: repository.id, entityId: commentReviewId, entityType: "PULL_REQUEST" },
            select: { id: true },
          }).then((e) => e?.id) || prParentEventId
        : prParentEventId;

      await createProjectEvent({
        repositoryId: repository.id,
        eventType: EventType.REVIEW_COMMENT,
        entityType: "ReviewComment",
        entityId: dbComment.id,
        parentEventId: commentParentId,
        actorName: senderLogin || "unknown",
        title: `New PR Comment by ${senderLogin}`,
        description: commentPayload.body,
        importance: EventImportance.LOW,
        source: EventSource.WEBHOOK,
        createdAt: new Date(commentPayload.created_at),
        metadata: {
          reviewer: senderLogin,
          body: commentPayload.body,
          path: commentPayload.path,
          line: commentPayload.line || commentPayload.original_line || null,
          prTitle: dbPR.title,
          prNumber: dbPR.number,
        },
      });

      return NextResponse.json({ success: true, event: "pull_request_review_comment", action });
    }

    return NextResponse.json({ message: `Event '${eventType}' received but no database action required.` });
  } catch (error: any) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}
