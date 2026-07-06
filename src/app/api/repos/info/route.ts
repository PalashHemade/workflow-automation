import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/repos/info?owner=torvalds&name=linux
 * Fetches public GitHub repository metadata to allow the UI to warn about large repos.
 * A repo is classified as "large" if its reported size > 500_000 KB (~500 MB on disk).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const owner = searchParams.get("owner")?.trim();
    const name = searchParams.get("name")?.trim();

    if (!owner || !name) {
      return NextResponse.json(
        { error: "Missing owner or name query parameters" },
        { status: 400 }
      );
    }

    // Retrieve the authenticated user's GitHub token
    const userAccount = await db.account.findFirst({
      where: { userId: session.user.id, provider: "github" },
    });

    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "github-analytics-dashboard",
    };

    if (userAccount?.access_token) {
      headers["Authorization"] = `Bearer ${userAccount.access_token}`;
    }

    const ghResponse = await fetch(
      `https://api.github.com/repos/${owner}/${name}`,
      { headers }
    );

    if (!ghResponse.ok) {
      const errText = await ghResponse.text();
      return NextResponse.json(
        { error: `GitHub API error: ${errText}` },
        { status: ghResponse.status }
      );
    }

    const repo = await ghResponse.json();

    // size is in KB as reported by GitHub
    const sizeKB: number = repo.size ?? 0;
    // Heuristic: repos > 500 MB on disk are "large"
    const isLarge = sizeKB > 500_000;

    return NextResponse.json({
      id: repo.id,
      name: repo.name,
      owner: repo.owner?.login,
      fullName: repo.full_name,
      description: repo.description ?? null,
      htmlUrl: repo.html_url,
      language: repo.language ?? null,
      stargazersCount: repo.stargazers_count ?? 0,
      forksCount: repo.forks_count ?? 0,
      openIssuesCount: repo.open_issues_count ?? 0,
      defaultBranch: repo.default_branch ?? "main",
      sizeKB,
      isLarge,
      isPrivate: repo.private ?? false,
      pushedAt: repo.pushed_at ?? null,
    });
  } catch (error: any) {
    console.error("Repo info error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
