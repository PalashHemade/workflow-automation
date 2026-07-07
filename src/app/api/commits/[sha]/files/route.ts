import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { sha: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sha } = params;
    const { searchParams } = new URL(req.url);
    const repositoryId = searchParams.get("repositoryId");
    if (!repositoryId) {
      return NextResponse.json({ error: "Missing repositoryId" }, { status: 400 });
    }

    // Verify ownership and get repo details for GitHub API call
    const repo = await db.repository.findUnique({
      where: { id: repositoryId },
      include: { user: { include: { accounts: true } } },
    });
    if (!repo || repo.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const commit = await db.commit.findFirst({
      where: { sha, repositoryId },
      include: { files: true },
    });

    if (!commit) {
      return NextResponse.json({ error: "Commit not found" }, { status: 404 });
    }

    // On-demand loading: if no files are cached in DB, fetch live from GitHub and persist
    if (commit.files.length === 0) {
      const githubAccount = repo.user.accounts.find((acc) => acc.provider === "github");
      const accessToken = githubAccount?.access_token;

      if (accessToken) {
        try {
          const res = await fetch(
            `https://api.github.com/repos/${repo.owner}/${repo.name}/commits/${sha}`,
            {
              headers: {
                Accept: "application/vnd.github+json",
                Authorization: `Bearer ${accessToken}`,
                "User-Agent": "github-analytics-dashboard",
              },
            }
          );

          if (res.ok) {
            const data = await res.json();
            const files = data.files || [];

            // Persist the files so subsequent loads are instant
            if (files.length > 0) {
              await db.commitFile.createMany({
                data: files.map((f: any) => ({
                  commitId: commit.id,
                  filename: f.filename,
                  status: f.status || "modified",
                  additions: f.additions || 0,
                  deletions: f.deletions || 0,
                  changes: f.changes || 0,
                  patch: f.patch || null,
                })),
                skipDuplicates: true,
              });

              // Return the freshly fetched files
              return NextResponse.json({
                commitSha: commit.sha,
                message: commit.message,
                committedAt: commit.committedAt,
                files,
                source: "github",
              });
            }
          } else {
            console.warn(`GitHub API returned ${res.status} for commit ${sha} files`);
          }
        } catch (fetchErr) {
          console.error(`Failed to fetch commit files from GitHub for ${sha}:`, fetchErr);
        }
      }
    }

    return NextResponse.json({
      commitSha: commit.sha,
      message: commit.message,
      committedAt: commit.committedAt,
      files: commit.files,
      source: "db",
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}
