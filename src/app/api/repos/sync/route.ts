import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { repositoryId, maxPages = 3 } = body;
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
        // On rate-limit or auth error, abort immediately
        if (commitsResponse.status === 401 || commitsResponse.status === 403) {
          return NextResponse.json(
            { error: `GitHub API error fetching commits: ${errText}` },
            { status: commitsResponse.status }
          );
        }
        // For other errors (e.g. 422 beyond history), break gracefully
        console.warn(`Commits page ${page} returned ${commitsResponse.status}. Stopping.`);
        break;
      }

      const pageData: any[] = await commitsResponse.json();
      rawCommits.push(...pageData);
      commitPagesFetched = page;

      // If fewer than 100 results, we've reached the last page
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

      // Link to contributor if resolved
      if (authorLogin) {
        const contributor = await db.contributor.upsert({
          where: { login: authorLogin },
          update: {
            githubId: authorGithubId,
            avatarUrl: authorAvatar,
            name: authorName,
            email: authorEmail,
          },
          create: {
            login: authorLogin,
            githubId: authorGithubId,
            avatarUrl: authorAvatar,
            name: authorName,
            email: authorEmail,
          },
        });
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
        const contributor = await db.contributor.upsert({
          where: { login: senderLogin },
          update: {
            githubId: senderGithubId,
            avatarUrl: senderAvatar,
          },
          create: {
            login: senderLogin,
            githubId: senderGithubId,
            avatarUrl: senderAvatar,
          },
        });
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

    // 7. Attempt Webhook Registration (only works if user owns the repository)
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
              events: ["push", "pull_request", "issues"],
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

    // 8. Update Repository Tracking State in Database
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
