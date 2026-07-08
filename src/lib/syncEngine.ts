import { db } from "@/lib/db";
import { fetchGitHubWithRetry } from "./github";
import { createProjectEvent, findPREventId, backfillTimelineEvents } from "./eventHelper";
import { EventType, EventImportance, EventSource, ProcessingStatus } from "@prisma/client";

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

// Sync files modified by a Pull Request
async function syncPRFiles(owner: string, name: string, prNumber: number, prId: string, accessToken: string) {
  try {
    const res = await fetchGitHubWithRetry(
      `https://api.github.com/repos/${owner}/${name}/pulls/${prNumber}/files?per_page=100`,
      accessToken
    );
    if (!res.ok) {
      console.warn(`Failed to fetch PR files for #${prNumber}. Status: ${res.status}`);
      return;
    }
    const files = await res.json();

    // Delete existing PR files to avoid duplicates
    await db.pullRequestFile.deleteMany({
      where: { pullRequestId: prId },
    });

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
        },
      });
    }
  } catch (err) {
    console.error(`Error syncing PR files for #${prNumber}:`, err);
  }
}

// Sync Reviews and inline Review Comments for a PR
async function syncPRReviewsAndComments(
  owner: string,
  name: string,
  prNumber: number,
  prId: string,
  prTitle: string,
  repositoryId: string,
  accessToken: string,
  syncSource: EventSource
) {
  try {
    // Find/Ensure PR Open parent event exists to create relationship chains
    const parentEventId = await findPREventId(repositoryId, prId);

    // 1. Fetch reviews
    const reviewsRes = await fetchGitHubWithRetry(
      `https://api.github.com/repos/${owner}/${name}/pulls/${prNumber}/reviews?per_page=100`,
      accessToken
    );
    if (!reviewsRes.ok) {
      console.warn(`Failed to fetch PR reviews for #${prNumber}. Status: ${reviewsRes.status}`);
      return;
    }
    const reviews = await reviewsRes.json();
    const reviewIdMap = new Map<bigint, string>();

    for (const r of reviews) {
      const reviewGithubId = BigInt(r.id);
      const senderLogin = r.user?.login;
      const senderGithubId = r.user?.id ? BigInt(r.user.id) : null;
      const senderAvatar = r.user?.avatar_url;

      let contributorId: string | null = null;
      if (senderLogin) {
        const contributor = await getOrCreateContributor(senderLogin, senderGithubId, senderAvatar);
        contributorId = contributor.id;
      }

      const dbReview = await db.review.upsert({
        where: { githubId: reviewGithubId },
        update: {
          state: r.state || "COMMENTED",
          body: r.body || null,
          submittedAt: r.submitted_at ? new Date(r.submitted_at) : new Date(),
          authorName: senderLogin || "unknown",
          authorAvatar: senderAvatar || null,
          contributorId,
        },
        create: {
          githubId: reviewGithubId,
          pullRequestId: prId,
          state: r.state || "COMMENTED",
          body: r.body || null,
          submittedAt: r.submitted_at ? new Date(r.submitted_at) : new Date(),
          authorName: senderLogin || "unknown",
          authorAvatar: senderAvatar || null,
          contributorId,
        },
      });

      reviewIdMap.set(reviewGithubId, dbReview.id);

      let reviewType: EventType = EventType.REVIEW_SUBMITTED;
      let importance: EventImportance = EventImportance.LOW;
      let reviewTitle = `PR Review Submitted by ${senderLogin}`;

      if (r.state === "APPROVED") {
        reviewType = EventType.REVIEW_APPROVED;
        importance = EventImportance.NORMAL;
        reviewTitle = `PR Approved by ${senderLogin}`;
      } else if (r.state === "CHANGES_REQUESTED") {
        reviewType = EventType.CHANGES_REQUESTED;
        importance = EventImportance.HIGH;
        reviewTitle = `PR Changes Requested by ${senderLogin}`;
      }

      await createProjectEvent({
        repositoryId,
        eventType: reviewType,
        entityType: "Review",
        entityId: dbReview.id,
        parentEventId,
        actorName: senderLogin || "unknown",
        title: reviewTitle,
        description: r.body || null,
        importance,
        source: syncSource,
        createdAt: r.submitted_at ? new Date(r.submitted_at) : new Date(),
        metadata: {
          reviewer: senderLogin,
          reviewState: r.state || "COMMENTED",
          commentsCount: 0,
          prTitle,
          prNumber,
        },
      });
    }

    // 2. Fetch review comments (inline comments on diff)
    const commentsRes = await fetchGitHubWithRetry(
      `https://api.github.com/repos/${owner}/${name}/pulls/${prNumber}/comments?per_page=100`,
      accessToken
    );
    if (!commentsRes.ok) {
      console.warn(`Failed to fetch PR review comments for #${prNumber}. Status: ${commentsRes.status}`);
      return;
    }
    const comments = await commentsRes.json();

    for (const c of comments) {
      const commentGithubId = BigInt(c.id);
      const reviewGithubId = c.pull_request_review_id ? BigInt(c.pull_request_review_id) : null;
      const reviewId = reviewGithubId ? reviewIdMap.get(reviewGithubId) : null;
      const senderLogin = c.user?.login;
      const senderGithubId = c.user?.id ? BigInt(c.user.id) : null;
      const senderAvatar = c.user?.avatar_url;

      let contributorId: string | null = null;
      if (senderLogin) {
        const contributor = await getOrCreateContributor(senderLogin, senderGithubId, senderAvatar);
        contributorId = contributor.id;
      }

      const dbComment = await db.reviewComment.upsert({
        where: { githubId: commentGithubId },
        update: {
          reviewId,
          path: c.path,
          line: c.line || c.original_line || null,
          body: c.body,
          diffHunk: c.diff_hunk || null,
          updatedAt: new Date(c.updated_at),
          authorName: senderLogin || "unknown",
          authorAvatar: senderAvatar || null,
          contributorId,
        },
        create: {
          githubId: commentGithubId,
          pullRequestId: prId,
          reviewId,
          path: c.path,
          line: c.line || c.original_line || null,
          body: c.body,
          diffHunk: c.diff_hunk || null,
          createdAt: new Date(c.created_at),
          updatedAt: new Date(c.updated_at),
          authorName: senderLogin || "unknown",
          authorAvatar: senderAvatar || null,
          contributorId,
        },
      });

      // Generate review comment event, setting review event (if found) or PR event as parent
      const commentParentId = reviewId
        ? await db.projectEvent.findFirst({
            where: { repositoryId, entityId: reviewId, eventType: { in: [EventType.REVIEW_SUBMITTED, EventType.REVIEW_APPROVED, EventType.CHANGES_REQUESTED] } },
            select: { id: true },
          }).then((e) => e?.id) || parentEventId
        : parentEventId;

      await createProjectEvent({
        repositoryId,
        eventType: EventType.REVIEW_COMMENT,
        entityType: "ReviewComment",
        entityId: dbComment.id,
        parentEventId: commentParentId,
        actorName: senderLogin || "unknown",
        title: `New PR Comment by ${senderLogin}`,
        description: c.body,
        importance: EventImportance.LOW,
        source: syncSource,
        createdAt: new Date(c.created_at),
        metadata: {
          reviewer: senderLogin,
          body: c.body,
          path: c.path,
          line: c.line || c.original_line || null,
          prTitle,
          prNumber,
        },
      });
    }
  } catch (err) {
    console.error(`Error syncing PR reviews/comments for #${prNumber}:`, err);
  }
}

// Sync branches
async function syncBranches(
  owner: string,
  name: string,
  repositoryId: string,
  defaultBranchName: string,
  accessToken: string,
  syncSource: EventSource
) {
  try {
    const res = await fetchGitHubWithRetry(
      `https://api.github.com/repos/${owner}/${name}/branches?per_page=100`,
      accessToken
    );
    if (!res.ok) {
      console.warn(`Failed to fetch branches. Status: ${res.status}`);
      return;
    }
    const branches = await res.json();

    // Query existing branches in DB before deleting them
    const existingBranches = await db.branch.findMany({
      where: { repositoryId },
    });
    const existingNames = new Set(existingBranches.map((b) => b.name));
    const newNames = new Set(branches.map((b: any) => b.name));

    // Clear old branches first to handle renames/deletes
    await db.branch.deleteMany({
      where: { repositoryId },
    });

    for (const b of branches) {
      await db.branch.create({
        data: {
          repositoryId,
          name: b.name,
          sha: b.commit?.sha || "",
          isProtected: b.protected || false,
          isDefault: b.name === defaultBranchName,
        },
      });

      // Event: Branch Created
      if (!existingNames.has(b.name)) {
        await createProjectEvent({
          repositoryId,
          eventType: EventType.BRANCH_CREATED,
          entityType: "Branch",
          entityId: `${repositoryId}-${b.name}`,
          actorName: "System",
          title: `Branch Created: ${b.name}`,
          importance: EventImportance.LOW,
          source: syncSource,
          metadata: {
            branchName: b.name,
            sha: b.commit?.sha || "",
          },
        });
      }
    }

    // Event: Branch Deleted
    for (const oldBranch of existingBranches) {
      if (!newNames.has(oldBranch.name)) {
        await createProjectEvent({
          repositoryId,
          eventType: EventType.BRANCH_DELETED,
          entityType: "Branch",
          entityId: `${repositoryId}-${oldBranch.name}-${Date.now()}`, // unique entityId
          actorName: "System",
          title: `Branch Deleted: ${oldBranch.name}`,
          importance: EventImportance.LOW,
          source: syncSource,
          metadata: {
            branchName: oldBranch.name,
            sha: oldBranch.sha,
          },
        });
      }
    }
  } catch (err) {
    console.error("Error syncing branches:", err);
  }
}

/**
 * Perform incremental synchronization for a given repository.
 */
export async function runIncrementalSync(
  repositoryId: string,
  syncType: "manual" | "scheduled" | "webhook",
  maxPages = 10
): Promise<{ commitsSynced: number; prsSynced: number }> {
  const startTime = new Date();
  const syncSource =
    syncType === "manual"
      ? EventSource.MANUAL
      : syncType === "scheduled"
      ? EventSource.SYNC
      : EventSource.WEBHOOK;

  // 1. Fetch Repository details
  const repository = await db.repository.findUnique({
    where: { id: repositoryId },
    include: { user: { include: { accounts: true } } },
  });

  if (!repository) {
    throw new Error(`Repository with ID ${repositoryId} not found.`);
  }

  // Find OAuth token
  const githubAccount = repository.user.accounts.find((acc) => acc.provider === "github");
  const accessToken = githubAccount?.access_token;
  if (!accessToken) {
    throw new Error(`GitHub access token not found for user ${repository.userId}.`);
  }

  // Update repository status to syncing
  await db.repository.update({
    where: { id: repositoryId },
    data: {
      syncStatus: "syncing",
      lastSyncedAt: startTime,
    },
  });

  // If there are no events in the database for this repository, backfill historical timeline events
  const existingEventsCount = await db.projectEvent.count({ where: { repositoryId } });
  if (existingEventsCount === 0) {
    await backfillTimelineEvents(repositoryId);
  }

  // Create BackgroundSyncLog record
  const syncLog = await db.backgroundSyncLog.create({
    data: {
      repositoryId,
      syncType,
      status: "running",
      startedAt: startTime,
    },
  });

  const { owner, name } = repository;
  let commitsSynced = 0;
  let prsSynced = 0;

  try {
    // 2. Fetch repo metadata to find default branch
    let defaultBranchName = "main";
    const repoInfoRes = await fetchGitHubWithRetry(`https://api.github.com/repos/${owner}/${name}`, accessToken);
    if (repoInfoRes.ok) {
      const repoInfo = await repoInfoRes.json();
      defaultBranchName = repoInfo.default_branch || "main";
    }

    // 3. Sync branches
    await syncBranches(owner, name, repositoryId, defaultBranchName, accessToken, syncSource);

    // 4. Incremental Commits Fetch
    const sinceParam = repository.lastSuccessfulSyncAt
      ? `&since=${new Date(repository.lastSuccessfulSyncAt.getTime() - 5 * 60 * 1000).toISOString()}`
      : "";

    const rawCommits: any[] = [];
    let stopCommitFetch = false;

    for (let page = 1; page <= maxPages; page++) {
      if (stopCommitFetch) break;

      const res = await fetchGitHubWithRetry(
        `https://api.github.com/repos/${owner}/${name}/commits?per_page=100&page=${page}${sinceParam}`,
        accessToken
      );

      if (!res.ok) {
        console.warn(`Commits page ${page} returned status ${res.status}. Stopping commits fetch.`);
        break;
      }

      const pageData: any[] = await res.json();
      if (pageData.length === 0) break;

      for (const commitData of pageData) {
        // Boundary Check: Stop if we hit the last successfully processed commit SHA
        if (repository.lastSuccessfulCommitSha && commitData.sha === repository.lastSuccessfulCommitSha) {
          stopCommitFetch = true;
          break;
        }
        rawCommits.push(commitData);
      }

      if (pageData.length < 100) break;
    }

    // Save Commits
    for (const rawCommit of rawCommits) {
      const sha = rawCommit.sha;
      const message = rawCommit.commit?.message || "";
      const url = rawCommit.html_url;
      const committedAt = new Date(rawCommit.commit?.author?.date || Date.now());

      const authorLogin = rawCommit.author?.login;
      const authorGithubId = rawCommit.author?.id ? BigInt(rawCommit.author.id) : null;
      const authorAvatar = rawCommit.author?.avatar_url;
      const authorName = rawCommit.commit?.author?.name || "unknown";
      const authorEmail = rawCommit.commit?.author?.email || "";

      let contributorId: string | null = null;
      if (authorLogin) {
        const contributor = await getOrCreateContributor(authorLogin, authorGithubId, authorAvatar, authorName, authorEmail);
        contributorId = contributor.id;
      }

      const dbCommit = await db.commit.upsert({
        where: { sha },
        update: {
          message,
          url,
          committedAt,
          authorName,
          authorEmail,
          authorAvatar,
          contributorId,
        },
        create: {
          sha,
          message,
          url,
          committedAt,
          repositoryId,
          authorName,
          authorEmail,
          authorAvatar,
          contributorId,
        },
      });

      // Event: Commit Created
      await createProjectEvent({
        repositoryId,
        eventType: EventType.COMMIT_CREATED,
        entityType: "Commit",
        entityId: dbCommit.id,
        actorName: authorName || authorLogin || "unknown",
        title: `Commit Pushed: ${message.split("\n")[0]}`,
        description: message,
        importance: EventImportance.LOW,
        source: syncSource,
        createdAt: committedAt,
        metadata: {
          sha,
          message,
          branch: defaultBranchName,
          filesChanged: 0,
          insertions: 0,
          deletions: 0,
        },
      });

      commitsSynced++;
    }

    const latestCommitSha = rawCommits[0]?.sha || repository.lastSuccessfulCommitSha;

    // 5. Incremental Pull Requests Fetch
    const rawPRs: any[] = [];
    let stopPRFetch = false;

    for (let page = 1; page <= maxPages; page++) {
      if (stopPRFetch) break;

      const res = await fetchGitHubWithRetry(
        `https://api.github.com/repos/${owner}/${name}/pulls?per_page=100&state=all&sort=updated&direction=desc&page=${page}`,
        accessToken
      );

      if (!res.ok) {
        console.warn(`PRs page ${page} returned status ${res.status}. Stopping PRs fetch.`);
        break;
      }

      const pageData: any[] = await res.json();
      if (pageData.length === 0) break;

      for (const prData of pageData) {
        const prUpdatedAt = new Date(prData.updated_at);
        if (
          repository.lastSuccessfulSyncAt &&
          prUpdatedAt.getTime() < repository.lastSuccessfulSyncAt.getTime() - 5 * 60 * 1000
        ) {
          stopPRFetch = true;
          break;
        }
        rawPRs.push(prData);
      }

      if (pageData.length < 100) break;
    }

    // Process PRs, PR files, and reviews/comments
    let highestPRNumber = repository.lastProcessedPullRequest || 0;

    for (const rawPR of rawPRs) {
      const prGithubId = BigInt(rawPR.id);
      const number = rawPR.number;
      const title = rawPR.title;
      const state = rawPR.state;
      const url = rawPR.html_url;
      const createdAt = new Date(rawPR.created_at);
      const updatedAt = new Date(rawPR.updated_at);
      const closedAt = rawPR.closed_at ? new Date(rawPR.closed_at) : null;
      const mergedAt = rawPR.merged_at ? new Date(rawPR.merged_at) : null;
      const merged = !!rawPR.merged_at;

      const senderLogin = rawPR.user?.login;
      const senderGithubId = rawPR.user?.id ? BigInt(rawPR.user.id) : null;
      const senderAvatar = rawPR.user?.avatar_url;

      let contributorId: string | null = null;
      if (senderLogin) {
        const contributor = await getOrCreateContributor(senderLogin, senderGithubId, senderAvatar);
        contributorId = contributor.id;
      }

      const dbPR = await db.pullRequest.upsert({
        where: { githubId: prGithubId },
        update: {
          number,
          title,
          state,
          url,
          updatedAt,
          closedAt,
          mergedAt,
          merged,
          authorName: senderLogin || "unknown",
          authorEmail: "",
          authorAvatar: senderAvatar,
          contributorId,
        },
        create: {
          githubId: prGithubId,
          number,
          title,
          state,
          url,
          createdAt,
          updatedAt,
          closedAt,
          mergedAt,
          merged,
          repositoryId,
          authorName: senderLogin || "unknown",
          authorEmail: "",
          authorAvatar: senderAvatar,
          contributorId,
        },
      });

      // Incremental Detail Sync
      await syncPRFiles(owner, name, number, dbPR.id, accessToken);
      await syncPRReviewsAndComments(owner, name, number, dbPR.id, title, repositoryId, accessToken, syncSource);

      // Enriched PR Opened event
      const prOpenedEvent = await createProjectEvent({
        repositoryId,
        eventType: EventType.PR_OPENED,
        entityType: "PullRequest",
        entityId: dbPR.id,
        actorName: senderLogin || "unknown",
        title: `PR Opened: #${number} ${title}`,
        description: title,
        importance: EventImportance.NORMAL,
        source: syncSource,
        createdAt,
        metadata: {
          prNumber: number,
          title,
          state: "open",
          commitsCount: 0,
          filesChanged: 0,
          reviewsCount: 0,
          mergeDurationMinutes: null,
        },
      });

      // PR Closed Event
      if (state === "closed" && !merged) {
        await createProjectEvent({
          repositoryId,
          eventType: EventType.PR_CLOSED,
          entityType: "PullRequest",
          entityId: dbPR.id,
          parentEventId: prOpenedEvent?.id,
          actorName: senderLogin || "unknown",
          title: `PR Closed: #${number} ${title}`,
          description: title,
          importance: EventImportance.NORMAL,
          source: syncSource,
          createdAt: closedAt || updatedAt,
          metadata: {
            prNumber: number,
            title,
            state: "closed",
          },
        });
      }

      // PR Merged Event
      if (merged && mergedAt) {
        const mergeDurationMinutes = Math.round((mergedAt.getTime() - createdAt.getTime()) / (1000 * 60));
        await createProjectEvent({
          repositoryId,
          eventType: EventType.PR_MERGED,
          entityType: "PullRequest",
          entityId: dbPR.id,
          parentEventId: prOpenedEvent?.id,
          actorName: senderLogin || "unknown",
          title: `PR Merged: #${number} ${title}`,
          description: title,
          importance: EventImportance.HIGH,
          source: syncSource,
          createdAt: mergedAt,
          metadata: {
            prNumber: number,
            title,
            state: "merged",
            mergeDurationMinutes,
          },
        });
      }

      // PR Updated Event (if open and has updates)
      if (state === "open" && updatedAt.getTime() > createdAt.getTime() + 60 * 1000) {
        await createProjectEvent({
          repositoryId,
          eventType: EventType.PR_UPDATED,
          entityType: "PullRequest",
          entityId: dbPR.id,
          parentEventId: prOpenedEvent?.id,
          actorName: senderLogin || "unknown",
          title: `PR Updated: #${number} ${title}`,
          description: title,
          importance: EventImportance.LOW,
          source: syncSource,
          createdAt: updatedAt,
          metadata: {
            prNumber: number,
            title,
            state: "open",
          },
        });
      }

      if (number > highestPRNumber) {
        highestPRNumber = number;
      }
      prsSynced++;
    }

    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();

    // 6. Update Repository sync metadata on success
    await db.repository.update({
      where: { id: repositoryId },
      data: {
        lastSuccessfulSyncAt: endTime,
        syncStatus: "success",
        lastSyncError: null,
        syncFailureCount: 0,
        nextAllowedSyncAt: null,
        lastSuccessfulCommitSha: latestCommitSha,
        lastProcessedPullRequest: highestPRNumber > 0 ? highestPRNumber : undefined,
      },
    });

    // Complete log record
    await db.backgroundSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "completed",
        completedAt: endTime,
        commitsProcessed: commitsSynced,
        prsProcessed: prsSynced,
        durationMs,
      },
    });

    // Event: Repository Synced
    await createProjectEvent({
      repositoryId,
      eventType: EventType.REPOSITORY_SYNCED,
      entityType: "Repository",
      entityId: repositoryId,
      actorName: "System",
      title: "Repository Synced Successfully",
      description: `Synchronized ${commitsSynced} commits and ${prsSynced} PRs.`,
      importance: EventImportance.NORMAL,
      source: syncSource,
      metadata: {
        durationMs,
        commitsProcessed: commitsSynced,
        prsProcessed: prsSynced,
        success: true,
        failureReason: null,
      },
    });

    return { commitsSynced, prsSynced };
  } catch (error: any) {
    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();
    console.error(`Error in runIncrementalSync for repo ${repositoryId}:`, error);

    // Compute exponential backoff for next sync
    const syncFailureCount = repository.syncFailureCount + 1;
    const backoffMinutes = Math.min(24 * 60, Math.pow(2, syncFailureCount));
    const nextAllowedSyncAt = new Date(Date.now() + backoffMinutes * 60 * 1000);

    // Update Repository sync metadata on failure
    await db.repository.update({
      where: { id: repositoryId },
      data: {
        lastFailedSyncAt: endTime,
        syncStatus: "failed",
        lastSyncError: error.message || "Unknown error occurred.",
        syncFailureCount,
        nextAllowedSyncAt,
      },
    });

    // Update Log record on failure
    await db.backgroundSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "failed",
        completedAt: endTime,
        errorMsg: error.message || "Unknown error occurred.",
        durationMs,
      },
    });

    // Event: Sync Failed
    await createProjectEvent({
      repositoryId,
      eventType: EventType.SYNC_FAILED,
      entityType: "Repository",
      entityId: repositoryId,
      actorName: "System",
      title: "Repository Sync Failed",
      description: error.message || "Unknown sync error.",
      importance: EventImportance.HIGH,
      source: syncSource,
      metadata: {
        durationMs,
        commitsProcessed: 0,
        prsProcessed: 0,
        success: false,
        failureReason: error.message,
      },
    });

    throw error;
  }
}
