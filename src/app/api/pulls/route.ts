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

    const state = searchParams.get("state") || "all"; // all, open, closed, merged
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit")) || 20));
    const skip = (page - 1) * limit;

    const whereClause: any = { repositoryId };

    if (state === "open") {
      whereClause.state = "open";
    } else if (state === "closed") {
      whereClause.state = "closed";
      whereClause.merged = false;
    } else if (state === "merged") {
      whereClause.merged = true;
    }

    const total = await db.pullRequest.count({ where: whereClause });
    const pulls = await db.pullRequest.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        contributor: true,
        files: true,
      },
    });

    // Serialize pulls: convert BigInt fields (pullRequest.githubId and contributor.githubId)
    // to strings because JSON.stringify cannot handle BigInt natively.
    const serializedPulls = pulls.map((pull) => ({
      ...pull,
      githubId: pull.githubId.toString(),
      contributor: pull.contributor
        ? {
            ...pull.contributor,
            githubId: pull.contributor.githubId?.toString() ?? null,
          }
        : null,
    }));

    return NextResponse.json({
      pulls: serializedPulls,
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
