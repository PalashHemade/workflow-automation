import { db } from "./db";
import { createLogger } from "./logger";

const log = createLogger("Cleaner");

/**
 * Prunes successful sync logs older than the retention period (default 30 days)
 * to keep database storage bounded, while permanently preserving failure logs.
 */
export async function pruneLogs(retentionDays = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  try {
    const { count } = await db.backgroundSyncLog.deleteMany({
      where: {
        status: "completed",
        startedAt: {
          lt: cutoffDate,
        },
      },
    });

    if (count > 0) {
      log.success("Pruned %s successful sync logs older than %s days", count, retentionDays);
    }
    return count;
  } catch (error: any) {
    log.error("Error pruning sync logs: %s", error?.message ?? error);
    return 0;
  }
}
