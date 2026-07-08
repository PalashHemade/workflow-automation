import { db } from "./db";

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
      console.log(`Pruned ${count} successful sync logs older than ${retentionDays} days.`);
    }
    return count;
  } catch (error) {
    console.error("Error pruning sync logs:", error);
    return 0;
  }
}
