import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

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

// Sync individual files modified by a commit
async function syncCommitFiles(owner: string, name: string, sha: string, commitId: string, headers: any) {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${name}/commits/${sha}`, { headers });
    if (!res.ok) {
      console.warn(`Failed to fetch commit details for ${sha}. Status: ${res.status}`);
      return;
    }
    const data = await res.json();
    const files = data.files || [];

    // Delete existing commit files to avoid duplicates
    await db.commitFile.deleteMany({
      where: { commitId },
    });

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
        },
      });
    }
  } catch (err) {
    console.error(`Error syncing commit files for ${sha}:`, err);
  }
}

// Sync files modified by a Pull Request
async function syncPRFiles(owner: string, name: string, prNumber: number, prId: string, headers: any) {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${name}/pulls/${prNumber}/files?per_page=100`, { headers });
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
async function syncPRReviewsAndComments(owner: string, name: string, prNumber: number, prId: string, headers: any) {
  try {
    // 1. Fetch reviews
    const reviewsRes = await fetch(`https://api.github.com/repos/${owner}/${name}/pulls/${prNumber}/reviews?per_page=100`, { headers });
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
    }

    // 2. Fetch review comments (inline comments on diff)
    const commentsRes = await fetch(`https://api.github.com/repos/${owner}/${name}/pulls/${prNumber}/comments?per_page=100`, { headers });
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

      await db.reviewComment.upsert({
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
    }
  } catch (err) {
    console.error(`Error syncing PR reviews/comments for #${prNumber}:`, err);
  }
}

// Sync branches
async function syncBranches(owner: string, name: string, repositoryId: string, defaultBranchName: string, headers: any) {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${name}/branches?per_page=100`, { headers });
    if (!res.ok) {
      console.warn(`Failed to fetch branches. Status: ${res.status}`);
      return;
    }
    const branches = await res.json();

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
    }
  } catch (err) {
    console.error("Error syncing branches:", err);
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { repositoryId, maxPages = 3, syncDepth = "full" } = body;
    const safeMaxPages = Math.min(Math.max(1, Number(maxPages) || 3), 20); // clamp 1–20

    if (!repositoryId) {
      return NextResponse.json({ error: "Missing repositoryId" }, { status: 400 });
    }

    // 2. Fetch the target repository from the DB
    const repository = await db.repository.findUnique({
      where: { id: repositoryId },
      include: { user: { include: { accounts: true } } },
    });

    if (!repository) {
      return NextResponse.json({ error: "Repository not found" }, { status: 404 });
    }

    // Ensure the current user has access to track/sync this repository
    if (repository.userId !== repository.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get the user's GitHub OAuth access token from their database account
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

    const { owner, name } = repository;
    const headers = {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "github-analytics-dashboard",
    };

    // Fetch repository's default branch
    let defaultBranchName = "main";
    try {
      const repoInfoRes = await fetch(`https://api.github.com/repos/${owner}/${name}`, { headers });
      if (repoInfoRes.ok) {
        const repoInfo = await repoInfoRes.json();
        defaultBranchName = repoInfo.default_branch || "main";
      }
    } catch (err) {
      console.warn("Failed to fetch default branch name, falling back to main:", err);
    }

    // 3. Fetch historical commits via paginated GitHub REST API
    console.log(`Syncing commits for ${owner}/${name} (maxPages=${safeMaxPages})...`);
    const rawCommits: any[] = [];
    let commitPagesFetched = 0;
    for (let page = 1; page <= safeMaxPages; page++) {
      const commitsResponse = await fetch(
        `https://api.github.com/repos/${owner}/${name}/commits?per_page=100&page=${page}`,
        { headers }
      );

      if (!commitsResponse.ok) {
        const errText = await commitsResponse.text();
        if (commitsResponse.status === 401 || commitsResponse.status === 403) {
          return NextResponse.json(
            { error: `GitHub API error fetching commits: ${errText}` },
            { status: commitsResponse.status }
          );
        }
        console.warn(`Commits page ${page} returned ${commitsResponse.status}. Stopping.`);
        break;
      }

      const pageData: any[] = await commitsResponse.json();
      rawCommits.push(...pageData);
      commitPagesFetched = page;

      if (pageData.length < 100) break;
    }

    // 4. Fetch historical PRs via paginated GitHub REST API
    console.log(`Syncing pull requests for ${owner}/${name}...`);
    const rawPRs: any[] = [];
    let prPagesFetched = 0;
    for (let page = 1; page <= safeMaxPages; page++) {
      const prsResponse = await fetch(
        `https://api.github.com/repos/${owner}/${name}/pulls?per_page=100&state=all&page=${page}`,
        { headers }
      );

      if (!prsResponse.ok) {
        const errText = await prsResponse.text();
        if (prsResponse.status === 401 || prsResponse.status === 403) {
          return NextResponse.json(
            { error: `GitHub API error fetching PRs: ${errText}` },
            { status: prsResponse.status }
          );
        }
        console.warn(`PRs page ${page} returned ${prsResponse.status}. Stopping.`);
        break;
      }

      const pageData: any[] = await prsResponse.json();
      rawPRs.push(...pageData);
      prPagesFetched = page;

      if (pageData.length < 100) break;
    }

    // 5. Save Commits in Database (using Upsert to avoid duplicates)
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

      await db.commit.upsert({
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
          repositoryId: repository.id,
          authorName,
          authorEmail,
          authorAvatar,
          contributorId,
        },
      });
    }

    // 6. Save PRs in Database (using Upsert to avoid duplicates)
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

      await db.pullRequest.upsert({
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
          repositoryId: repository.id,
          authorName: senderLogin || "unknown",
          authorEmail: "",
          authorAvatar: senderAvatar,
          contributorId,
        },
      });
    }

    // NOTE: Commit file details are now fetched on-demand when a user views a specific
    // commit via GET /api/commits/[sha]/files. This avoids making 100s of GitHub API
    // calls during sync that can hit rate limits and cause silent data gaps.

    // 8. Sync PR changes & reviews
    console.log(`Syncing detailed files/reviews for ${rawPRs.length} PRs...`);
    for (const rawPR of rawPRs) {
      const dbPR = await db.pullRequest.findUnique({ where: { githubId: BigInt(rawPR.id) } });
      if (dbPR) {
        await syncPRFiles(owner, name, rawPR.number, dbPR.id, headers);
        await syncPRReviewsAndComments(owner, name, rawPR.number, dbPR.id, headers);
      }
    }

    // 9. Sync branches
    console.log(`Syncing branches for ${owner}/${name}...`);
    await syncBranches(owner, name, repository.id, defaultBranchName, headers);

    // 10. Attempt Webhook Registration (only works if user owns the repository)
    let webhookCreated = false;
    const webhookUrl = `${process.env.APP_URL || "https://yourdomain.com"}/api/webhooks/github`;
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

    if (webhookSecret) {
      try {
        console.log(`Registering webhook for ${owner}/${name}...`);
        const webhookResponse = await fetch(
          `https://api.github.com/repos/${owner}/${name}/hooks`,
          {
            method: "POST",
            headers: {
              ...headers,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: "web",
              active: true,
              events: [
                "push",
                "pull_request",
                "pull_request_review",
                "pull_request_review_comment",
                "create",
                "delete"
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
          webhookCreated = true;
          console.log(`Successfully registered webhook on GitHub for ${owner}/${name}.`);
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

    // 11. Update Repository Tracking State in Database
    await db.repository.update({
      where: { id: repositoryId },
      data: {
        isTracked: true,
        webhookEnabled: webhookCreated,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Sync completed successfully.",
      commitsSynced: rawCommits.length,
      prsSynced: rawPRs.length,
      webhookEnabled: webhookCreated,
      paginationInfo: {
        maxPagesRequested: safeMaxPages,
        commitPagesFetched,
        prPagesFetched,
      },
    });
  } catch (error: any) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
