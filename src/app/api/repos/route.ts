import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { getServerSession } from "next-auth";
import { authOptions, getUserGithubLogin } from "@/lib/auth/auth";
import { getValidGithubAccessToken } from "@/lib/auth/githubTokenService";
import { createLogger } from "@/lib/core/logger";

const log = createLogger("Repos");

export const dynamic = "force-dynamic";

/**
 * GET: Retrieve repositories tracked in DB and list user's available repos on GitHub
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.id) {
      log.warn("GET /api/repos rejected — no active session");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const githubLogin = await getUserGithubLogin(userId);

    // Fetch repositories already registered in our DB that this user tracked or owns on GitHub
    const dbRepos = await db.repository.findMany({
      where: {
        OR: [
          { userId },
          { trackingUserIds: { contains: `,${userId},` } },
          ...(githubLogin ? [{ owner: githubLogin }] : []),
        ],
      },
      include: { webhook: true },
      orderBy: { name: "asc" },
    });

    let githubRepos: any[] = [];
    let githubError: string | null = null;
    let accessToken: string | null = null;

    try {
      accessToken = await getValidGithubAccessToken(userId);
    } catch (err: any) {
      githubError = err?.message ?? "GitHub account not connected — please sign in with GitHub";
      log.warn("No usable GitHub token for user %s: %s", userId, githubError);
    }

    if (accessToken) {
      try {
        const apiUrl = "https://api.github.com/user/repos?visibility=all&affiliation=owner,collaborator,organization_member&per_page=100&sort=updated";

        const ghResponse = await fetch(apiUrl, {
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${accessToken}`,
            "User-Agent": "github-analytics-dashboard",
          },
          cache: "no-store",
        });

        if (ghResponse.ok) {
          githubRepos = await ghResponse.json();
          log.success("Fetched %d GitHub repos for user %s", githubRepos.length, userId);
        } else {
          const errText = await ghResponse.text();
          githubError = `GitHub API ${ghResponse.status}: ${errText}`;
          log.error("GitHub API error listing repos for user %s: %s", userId, githubError);
        }
      } catch (err: any) {
        githubError = err?.message ?? "Network error calling GitHub API";
        log.error("Network error listing GitHub repos for user %s: %s", userId, githubError);
      }
    }

    const serializedDbRepos = dbRepos.map((repo) => ({
      ...repo,
      githubId: repo.githubId.toString(),
      webhook: repo.webhook
        ? {
            ...repo.webhook,
            githubWebhookId: repo.webhook.githubWebhookId?.toString() || null,
          }
        : null,
    }));

    return NextResponse.json({
      dbRepos: serializedDbRepos,
      githubRepos: githubRepos.map((r: any) => ({
        githubId: r.id,
        name: r.name,
        owner: r.owner.login,
        fullName: r.full_name,
        htmlUrl: r.html_url,
      })),
    });
  } catch (error: any) {
    log.error("GET /api/repos failed: %s", error?.message ?? error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST: Register a repository (either owned or external) for tracking
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await req.json();
    const { owner, name, createNewOnGitHub, description: repoDesc, isPrivate } = body;

    if (!name) {
      return NextResponse.json({ error: "Missing repository name" }, { status: 400 });
    }

    // Get a valid (auto-refreshed if needed) access token to fetch or create the repository
    let accessToken: string;
    try {
      accessToken = await getValidGithubAccessToken(userId);
    } catch (err: any) {
      log.error("POST /api/repos: no usable GitHub token for user %s: %s", userId, err?.message ?? err);
      return NextResponse.json({ error: "GitHub Account not found" }, { status: 400 });
    }

    let repoData: any;

    if (createNewOnGitHub) {
      // Create a brand new repository directly on GitHub
      const createResponse = await fetch("https://api.github.com/user/repos", {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "github-analytics-dashboard",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          description: repoDesc || "",
          private: isPrivate ?? false,
          auto_init: true, // auto initialize with README so default branch exists
        }),
      });

      if (!createResponse.ok) {
        const errText = await createResponse.text();
        log.error("Failed to create GitHub repo %s for user %s: %s", name, userId, errText);
        return NextResponse.json(
          { error: `Could not create repository on GitHub: ${errText}` },
          { status: createResponse.status }
        );
      }

      repoData = await createResponse.json();
      log.success("Created new GitHub repo %s for user %s", repoData.full_name, userId);
    } else {
      if (!owner) {
        return NextResponse.json({ error: "Missing repository owner" }, { status: 400 });
      }

      // Fetch repository information from GitHub API
      const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${name}`, {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "github-analytics-dashboard",
        },
        cache: "no-store",
      });

      if (!repoResponse.ok) {
        const errText = await repoResponse.text();
        log.error("Failed to fetch repo metadata for %s/%s: %s", owner, name, errText);
        return NextResponse.json(
          { error: `Could not fetch repo metadata from GitHub: ${errText}` },
          { status: repoResponse.status }
        );
      }

      repoData = await repoResponse.json();
    }

    // Check if repository already exists in DB
    const existingRepo = await db.repository.findUnique({
      where: { githubId: BigInt(repoData.id) },
      include: { webhook: true },
    });

    if (existingRepo) {
      const isTracker = existingRepo.userId === userId || existingRepo.trackingUserIds.includes(`,${userId},`);
      
      if (isTracker) {
        return NextResponse.json({
          message: "Repository already registered for tracking.",
          repository: {
            ...existingRepo,
            githubId: existingRepo.githubId.toString(),
            webhook: existingRepo.webhook
              ? {
                  ...existingRepo.webhook,
                  githubWebhookId: existingRepo.webhook.githubWebhookId?.toString() || null,
                }
              : null,
          },
        });
      }

      // If not already in trackers list, append current user ID to trackingUserIds
      const currentTrackers = existingRepo.trackingUserIds || "";
      const newTrackers = currentTrackers ? `${currentTrackers}${userId},` : `,${userId},`;

      const updatedRepo = await db.repository.update({
        where: { id: existingRepo.id },
        data: {
          trackingUserIds: newTrackers,
        },
        include: { webhook: true },
      });

      return NextResponse.json({
        success: true,
        message: "Repository registered and tracked successfully.",
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
    }

    // Create the repository entry in the database along with its webhook record
    const newRepo = await db.repository.create({
      data: {
        githubId: BigInt(repoData.id),
        name: repoData.name,
        owner: repoData.owner.login,
        fullName: repoData.full_name,
        htmlUrl: repoData.html_url,
        isTracked: false,
        userId,
        webhook: {
          create: {
            status: "inactive",
            isActive: false,
          },
        },
      },
      include: {
        webhook: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Repository registered. Triggering sync next.",
      repository: {
        ...newRepo,
        githubId: newRepo.githubId.toString(),
        webhook: newRepo.webhook
          ? {
              ...newRepo.webhook,
              githubWebhookId: newRepo.webhook.githubWebhookId?.toString() || null,
            }
          : null,
      },
    });
  } catch (error: any) {
    log.error("POST /api/repos failed: %s", error?.message ?? error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}

