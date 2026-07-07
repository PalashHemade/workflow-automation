import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const repositoryId = searchParams.get("repositoryId");
    if (!repositoryId) {
      return NextResponse.json({ error: "Missing repositoryId" }, { status: 400 });
    }

    // Verify ownership
    const repo = await db.repository.findUnique({
      where: { id: repositoryId },
    });
    if (!repo || repo.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit")) || 20));
    const skip = (page - 1) * limit;

    const total = await db.commit.count({ where: { repositoryId } });
    const commits = await db.commit.findMany({
      where: { repositoryId },
      orderBy: { committedAt: "desc" },
      skip,
      take: limit,
      include: {
        contributor: true,
      },
    });

    // Serialize commits: convert BigInt fields (e.g. contributor.githubId) to strings
    // because JSON.stringify cannot handle BigInt natively.
    const serializedCommits = commits.map((commit) => ({
      ...commit,
      contributor: commit.contributor
        ? {
            ...commit.contributor,
            githubId: commit.contributor.githubId?.toString() ?? null,
          }
        : null,
    }));

    return NextResponse.json({
      commits: serializedCommits,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}
