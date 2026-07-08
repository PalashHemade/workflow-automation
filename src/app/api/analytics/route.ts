import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions, checkRepositoryAccess } from "@/lib/auth";

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
    const repo = await checkRepositoryAccess(repositoryId, session.user.id);
    if (!repo) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 1. Calculate PR Review Cycle Time (creation -> first review submitted)
    const prsWithReviews = await db.pullRequest.findMany({
      where: {
        repositoryId,
        reviews: { some: {} },
      },
      select: {
        createdAt: true,
        reviews: {
          orderBy: { submittedAt: "asc" },
          take: 1,
          select: { submittedAt: true },
        },
      },
    });

    let avgReviewCycleHours = 0;
    if (prsWithReviews.length > 0) {
      const totalCycleMs = prsWithReviews.reduce((acc, pr) => {
        const start = new Date(pr.createdAt).getTime();
        const end = new Date(pr.reviews[0].submittedAt).getTime();
        return acc + Math.max(0, end - start);
      }, 0);
      avgReviewCycleHours = totalCycleMs / prsWithReviews.length / (1000 * 60 * 60);
    }

    // 2. PR Review approval rates
    const reviews = await db.review.groupBy({
      by: ["state"],
      where: {
        pullRequest: { repositoryId },
      },
      _count: { id: true },
    });

    const reviewsStateMap: Record<string, number> = { APPROVED: 0, CHANGES_REQUESTED: 0, COMMENTED: 0 };
    reviews.forEach((r) => {
      reviewsStateMap[r.state] = r._count.id;
    });

    const totalReviews = Object.values(reviewsStateMap).reduce((a, b) => a + b, 0);
    const approvalRate = totalReviews > 0 ? (reviewsStateMap["APPROVED"] / totalReviews) * 100 : 0;

    // 3. File Churn (top 10 files with most modifications)
    const fileChurnRaw = await db.commitFile.groupBy({
      by: ["filename"],
      where: {
        commit: { repositoryId },
      },
      _sum: {
        additions: true,
        deletions: true,
        changes: true,
      },
      orderBy: {
        _sum: {
          changes: "desc",
        },
      },
      take: 10,
    });

    const fileChurn = fileChurnRaw.map((f) => ({
      filename: f.filename.split("/").pop() || f.filename,
      filepath: f.filename,
      additions: f._sum.additions || 0,
      deletions: f._sum.deletions || 0,
      changes: f._sum.changes || 0,
    }));

    // 4. Weekly churn code additions vs deletions (last 4 weeks)
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

    const recentCommitFiles = await db.commitFile.findMany({
      where: {
        commit: {
          repositoryId,
          committedAt: { gte: fourWeeksAgo },
        },
      },
      select: {
        additions: true,
        deletions: true,
        commit: {
          select: { committedAt: true },
        },
      },
    });

    // Buckets for the last 4 weeks
    const weeklyChurnMap: Record<string, { additions: number; deletions: number }> = {};
    for (let i = 3; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i * 7);
      const weekLabel = `Wk -${i}`;
      weeklyChurnMap[weekLabel] = { additions: 0, deletions: 0 };
    }

    recentCommitFiles.forEach((file) => {
      const commitDate = new Date(file.commit.committedAt);
      const diffDays = Math.floor((Date.now() - commitDate.getTime()) / (1000 * 60 * 60 * 24));
      
      let weekKey = "Wk 0";
      if (diffDays >= 21) weekKey = "Wk -3";
      else if (diffDays >= 14) weekKey = "Wk -2";
      else if (diffDays >= 7) weekKey = "Wk -1";
      else weekKey = "Wk -0"; // Current week

      // Map wk-0 etc to safe indices
      const label = weekKey.replace("-0", "-0"); // safety
      const finalLabel = label === "Wk -0" ? "Wk 0" : label;
      
      const targetLabel = Object.keys(weeklyChurnMap).find(k => k.includes(weekKey.replace("Wk -", ""))) || "Wk -0";
      if (weeklyChurnMap[targetLabel]) {
        weeklyChurnMap[targetLabel].additions += file.additions;
        weeklyChurnMap[targetLabel].deletions += file.deletions;
      }
    });

    const weeklyChurn = Object.keys(weeklyChurnMap).map((week) => ({
      week,
      additions: weeklyChurnMap[week].additions,
      deletions: weeklyChurnMap[week].deletions,
    }));

    // 5. PR states breakdown
    const prStateGroup = await db.pullRequest.groupBy({
      by: ["state", "merged"],
      where: { repositoryId },
      _count: { id: true },
    });

    const prStateSummary = { open: 0, closed: 0, merged: 0 };
    prStateGroup.forEach((g) => {
      if (g.merged) {
        prStateSummary.merged += g._count.id;
      } else if (g.state === "open") {
        prStateSummary.open += g._count.id;
      } else {
        prStateSummary.closed += g._count.id;
      }
    });

    return NextResponse.json({
      avgReviewCycleHours: Math.round(avgReviewCycleHours * 10) / 10,
      approvalRate: Math.round(approvalRate),
      reviewsBreakdown: reviewsStateMap,
      fileChurn,
      weeklyChurn,
      prStateSummary,
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}
