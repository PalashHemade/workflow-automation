import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions, getUserGithubLogin } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET: Retrieve repositories tracked in DB and list user's available repos on GitHub
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
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

    // Fetch user's GitHub Account to retrieve the access token
    const userAccount = await db.account.findFirst({
      where: { userId, provider: "github" },
    });

    let githubRepos: any[] = [];
    if (userAccount?.access_token) {
      try {
        const ghResponse = await fetch(
          "https://api.github.com/user/repos?per_page=50&sort=updated",
          {
            headers: {
              Accept: "application/vnd.github+json",
              Authorization: `Bearer ${userAccount.access_token}`,
              "User-Agent": "github-analytics-dashboard",
            },
            cache: "no-store",
          }
        );
        if (ghResponse.ok) {
          githubRepos = await ghResponse.json();
        }
      } catch (err) {
        console.error("Error fetching repos from GitHub API:", err);
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
    console.error("Fetch repos error:", error);
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
    const { owner, name } = body;

    if (!owner || !name) {
      return NextResponse.json({ error: "Missing owner or name" }, { status: 400 });
    }

    // Find user's access token to fetch repository metadata
    const userAccount = await db.account.findFirst({
      where: { userId, provider: "github" },
    });

    if (!userAccount?.access_token) {
      return NextResponse.json({ error: "GitHub Account not found" }, { status: 400 });
    }

    // Fetch repository information from GitHub API
    const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${name}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${userAccount.access_token}`,
        "User-Agent": "github-analytics-dashboard",
      },
      cache: "no-store",
    });

    if (!repoResponse.ok) {
      const errText = await repoResponse.text();
      return NextResponse.json(
        { error: `Could not fetch repo metadata from GitHub: ${errText}` },
        { status: repoResponse.status }
      );
    }

    const repoData = await repoResponse.json();

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
    console.error("Register repo error:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}

