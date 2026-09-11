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
    console.log("[REPOS DEBUG] ====== GET /api/repos START ======");
    console.log("[REPOS DEBUG] Session exists:", !!session);
    console.log("[REPOS DEBUG] Session user:", session?.user ? { id: (session.user as any).id, email: session.user.email, name: session.user.name } : "NO USER");

    if (!session || !session.user || !session.user.id) {
      console.log("[REPOS DEBUG] ❌ UNAUTHORIZED — no session or session.user.id");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    console.log("[REPOS DEBUG] userId:", userId);

    const githubLogin = await getUserGithubLogin(userId);
    console.log("[REPOS DEBUG] githubLogin:", githubLogin);

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
    console.log("[REPOS DEBUG] dbRepos count:", dbRepos.length);

    // Fetch user's GitHub Account to retrieve the access token
    const userAccount = await db.account.findFirst({
      where: { userId, provider: "github" },
    });
    console.log("[REPOS DEBUG] userAccount found:", !!userAccount);
    console.log("[REPOS DEBUG] userAccount.provider:", userAccount?.provider);
    console.log("[REPOS DEBUG] userAccount.access_token exists:", !!userAccount?.access_token);
    console.log("[REPOS DEBUG] userAccount.access_token first 10 chars:", userAccount?.access_token?.substring(0, 10) + "...");

    let githubRepos: any[] = [];
    let githubError: string | null = null;
    const hasToken = !!userAccount?.access_token;

    if (hasToken) {
      try {
        const apiUrl = "https://api.github.com/user/repos?visibility=all&affiliation=owner,collaborator,organization_member&per_page=100&sort=updated";
        console.log("[REPOS DEBUG] Fetching GitHub API:", apiUrl);

        const ghResponse = await fetch(apiUrl, {
            headers: {
              Accept: "application/vnd.github+json",
              Authorization: `Bearer ${userAccount!.access_token}`,
              "User-Agent": "github-analytics-dashboard",
            },
            cache: "no-store",
          }
        );

        console.log("[REPOS DEBUG] GitHub API response status:", ghResponse.status);
        console.log("[REPOS DEBUG] GitHub API response headers - X-RateLimit-Remaining:", ghResponse.headers.get("x-ratelimit-remaining"));
        console.log("[REPOS DEBUG] GitHub API response headers - X-OAuth-Scopes:", ghResponse.headers.get("x-oauth-scopes"));

        if (ghResponse.ok) {
          githubRepos = await ghResponse.json();
          console.log("[REPOS DEBUG] ✅ GitHub repos fetched successfully, count:", githubRepos.length);
          if (githubRepos.length > 0) {
            console.log("[REPOS DEBUG] First 3 repos:", githubRepos.slice(0, 3).map((r: any) => r.full_name));
          }
        } else {
          const errText = await ghResponse.text();
          githubError = `GitHub API ${ghResponse.status}: ${errText}`;
          console.error("[REPOS DEBUG] ❌ GitHub API error:", githubError);
        }
      } catch (err: any) {
        githubError = err?.message ?? "Network error calling GitHub API";
        console.error("[REPOS DEBUG] ❌ Network/fetch error:", err);
      }
    } else {
      githubError = userAccount
        ? "GitHub account found but access_token is null — please sign out and sign back in"
        : "No GitHub account linked to this user in the database";
      console.error("[REPOS DEBUG] ❌ No token:", githubError);
    }

    console.log("[REPOS DEBUG] ====== FINAL RESULT: dbRepos=" + dbRepos.length + ", githubRepos=" + githubRepos.length + ", error=" + githubError + " ======");

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
      // Diagnostic fields — shown in UI if githubRepos is empty
      _debug: { hasToken, githubError, userId, githubLogin, dbReposCount: dbRepos.length, githubReposCount: githubRepos.length },
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
    const { owner, name, createNewOnGitHub, description: repoDesc, isPrivate } = body;

    if (!name) {
      return NextResponse.json({ error: "Missing repository name" }, { status: 400 });
    }

    // Find user's access token to fetch or create repository
    const userAccount = await db.account.findFirst({
      where: { userId, provider: "github" },
    });

    if (!userAccount?.access_token) {
      return NextResponse.json({ error: "GitHub Account not found" }, { status: 400 });
    }

    let repoData: any;

    if (createNewOnGitHub) {
      // Create a brand new repository directly on GitHub
      const createResponse = await fetch("https://api.github.com/user/repos", {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${userAccount.access_token}`,
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
        return NextResponse.json(
          { error: `Could not create repository on GitHub: ${errText}` },
          { status: createResponse.status }
        );
      }

      repoData = await createResponse.json();
    } else {
      if (!owner) {
        return NextResponse.json({ error: "Missing repository owner" }, { status: 400 });
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
    console.error("Register repo error:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}

