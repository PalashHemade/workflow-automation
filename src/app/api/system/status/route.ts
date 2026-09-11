import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth";
import { createLogger } from "@/lib/core/logger";

const log = createLogger("SystemStatus");

export const dynamic = "force-dynamic";

/**
 * GET: Retrieve background synchronization service health and logs
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Retrieve singleton status
    const syncStatus = await db.backgroundSyncStatus.findUnique({
      where: { id: "singleton" },
    });

    // Retrieve recent logs (limit to last 20)
    const recentLogs = await db.backgroundSyncLog.findMany({
      orderBy: { startedAt: "desc" },
      take: 20,
      include: {
        repository: {
          select: {
            name: true,
            owner: true,
            displayName: true,
          },
        },
      },
    });

    const statusValue = syncStatus?.status || "healthy";
    const lastRunAt = syncStatus?.lastRunAt || null;
    const errorMsg = syncStatus?.errorMsg || null;

    // Rate limits (from global state)
    const rateLimitRemaining = globalThis.lastRateLimitRemaining ?? null;
    const rateLimitReset = globalThis.lastRateLimitReset
      ? globalThis.lastRateLimitReset.toISOString()
      : null;

    // Retrieve global stats: count of success vs failed logs in DB
    const successLogsCount = await db.backgroundSyncLog.count({
      where: { status: "completed" },
    });
    const failedLogsCount = await db.backgroundSyncLog.count({
      where: { status: "failed" },
    });

    return NextResponse.json({
      health: {
        status: statusValue,
        lastRunAt,
        errorMsg,
      },
      rateLimit: {
        remaining: rateLimitRemaining,
        reset: rateLimitReset,
      },
      statistics: {
        successCount: successLogsCount,
        failureCount: failedLogsCount,
      },
      recentLogs: recentLogs.map((log) => ({
        id: log.id,
        startedAt: log.startedAt,
        completedAt: log.completedAt,
        syncType: log.syncType,
        status: log.status,
        commitsProcessed: log.commitsProcessed,
        prsProcessed: log.prsProcessed,
        durationMs: log.durationMs,
        errorMsg: log.errorMsg,
        repo: log.repository
          ? {
              name: log.repository.name,
              owner: log.repository.owner,
              displayName: log.repository.displayName,
            }
          : null,
      })),
    });
  } catch (error: any) {
    log.error("System status API error: %s", error?.message ?? error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
