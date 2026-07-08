import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions, checkRepositoryAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const repositoryId = searchParams.get("repositoryId");

    if (!repositoryId) {
      return NextResponse.json({ error: "Missing repositoryId" }, { status: 400 });
    }

    // 1. Verify repository exists and user has access
    const repository = await checkRepositoryAccess(repositoryId, session.user.id);

    if (!repository) {
      return NextResponse.json({ error: "Forbidden or Repository not found" }, { status: 403 });
    }


    // 2. Calculate general statistics
    const totalCommits = await db.commit.count({
      where: { repositoryId },
    });

    const totalPrs = await db.pullRequest.count({
      where: { repositoryId },
    });

    const openPrsCount = await db.pullRequest.count({
      where: { repositoryId, state: "open" },
    });

    // 3. Calculate Average Pull Request Merge Time (difference between mergedAt and createdAt)
    const mergedPrs = await db.pullRequest.findMany({
      where: {
        repositoryId,
        merged: true,
        mergedAt: { not: null },
      },
      select: {
        createdAt: true,
        mergedAt: true,
      },
    });

    let averagePrMergeTimeHours = 0;
    if (mergedPrs.length > 0) {
      const totalMergeDurationMs = mergedPrs.reduce((acc, pr) => {
        const start = new Date(pr.createdAt).getTime();
        const end = new Date(pr.mergedAt!).getTime();
        return acc + (end - start);
      }, 0);

      const averageDurationMs = totalMergeDurationMs / mergedPrs.length;
      averagePrMergeTimeHours = averageDurationMs / (1000 * 60 * 60); // convert ms to hours
    }

    // 4. Get Commit Frequency Over Time (grouped by day for the last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentCommits = await db.commit.findMany({
      where: {
        repositoryId,
        committedAt: {
          gte: thirtyDaysAgo,
        },
      },
      select: {
        committedAt: true,
      },
      orderBy: {
        committedAt: "asc",
      },
    });

    // Group commits by YYYY-MM-DD
    const frequencyMap: Record<string, number> = {};
    // Pre-populate last 30 days with 0s to make chart smooth
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      frequencyMap[dateStr] = 0;
    }

    recentCommits.forEach((commit) => {
      const dateStr = new Date(commit.committedAt).toISOString().split("T")[0];
      if (dateStr in frequencyMap) {
        frequencyMap[dateStr]++;
      } else {
        // Fallback for commits slightly older/newer than the exact 30-day bracket
        frequencyMap[dateStr] = 1;
      }
    });

    const commitFrequency = Object.keys(frequencyMap).map((date) => ({
      date,
      count: frequencyMap[date],
    }));

    // 5. Get Top Contributors by Commit Count
    const contributorGroup = await db.commit.groupBy({
      by: ["authorName", "authorAvatar"],
      where: { repositoryId },
      _count: {
        sha: true,
      },
      orderBy: {
        _count: {
          sha: "desc",
        },
      },
      take: 10,
    });

    const topContributors = contributorGroup.map((item) => ({
      name: item.authorName,
      avatar: item.authorAvatar,
      commits: item._count.sha,
    }));

    return NextResponse.json({
      repositoryName: repository.displayName || repository.name,
      fullName: repository.fullName,
      webhookEnabled: repository.webhookEnabled,
      isArchived: repository.isArchived,
      syncStatus: repository.syncStatus,
      lastSyncedAt: repository.lastSuccessfulSyncAt || repository.lastSyncedAt,
      lastSyncError: repository.lastSyncError,
      pollingInterval: repository.pollingInterval,
      totalCommits,
      totalPrs,
      openPrsCount,
      averagePrMergeTimeHours: Math.round(averagePrMergeTimeHours * 10) / 10, // round to 1 decimal
      commitFrequency,
      topContributors,
    });
  } catch (error: any) {
    console.error("Fetch metrics error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
