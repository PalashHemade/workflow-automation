import { db } from "./db";
import { runIncrementalSync } from "./syncEngine";
import { pruneLogs } from "./cleaner";

/**
 * Main stateless background sync execution job.
 * Called by cron triggered HTTP endpoints (Vercel Cron, GitHub Actions, etc.).
 */
export async function runStatelessSyncJob() {
  const startTime = new Date();

  // Ensure singleton BackgroundSyncStatus exists
  await db.backgroundSyncStatus.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", status: "healthy", lastRunAt: startTime },
  });

  // Check rate-limit health from previous calls.
  // If the global rate limit remaining is extremely low and we haven't hit the reset time yet, skip polling.
  if (
    globalThis.lastRateLimitRemaining !== undefined &&
    globalThis.lastRateLimitRemaining <= 10 &&
    globalThis.lastRateLimitReset &&
    globalThis.lastRateLimitReset > new Date()
  ) {
    const errorMsg = `Sync skipped: GitHub API rate limits exhausted. Reset in ${Math.ceil(
      (globalThis.lastRateLimitReset.getTime() - Date.now()) / 1000
    )} seconds.`;
    console.warn(errorMsg);

    await db.backgroundSyncStatus.update({
      where: { id: "singleton" },
      data: {
        status: "degraded",
        lastRunAt: startTime,
        errorMsg,
      },
    });

    return { success: false, message: errorMsg, reposSynced: 0 };
  }

  // Identify eligible repositories:
  // - Tracked (isTracked = true)
  // - Not archived (isArchived = false)
  // - Webhook-disabled (webhookEnabled = false)
  // - Cooldown elapsed (nextAllowedSyncAt is null or <= now)
  const eligibleRepos = await db.repository.findMany({
    where: {
      isTracked: true,
      isArchived: false,
      webhookEnabled: false,
      OR: [
        { nextAllowedSyncAt: null },
        { nextAllowedSyncAt: { lte: startTime } },
      ],
    },
  });

  if (eligibleRepos.length === 0) {
    await db.backgroundSyncStatus.update({
      where: { id: "singleton" },
      data: {
        status: "healthy",
        lastRunAt: startTime,
        errorMsg: null,
      },
    });

    // Prune logs daily / on every empty cron run to keep things clean
    await pruneLogs(30);

    return { success: true, message: "No repositories require scheduled synchronization.", reposSynced: 0 };
  }

  console.log(`Background scheduler: Found ${eligibleRepos.length} eligible repositories to sync.`);
  let successCount = 0;
  let failCount = 0;
  let firstErrorMsg: string | null = null;

  for (const repo of eligibleRepos) {
    try {
      console.log(`Background sync starting for ${repo.fullName} (${repo.id})...`);
      await runIncrementalSync(repo.id, "scheduled");
      successCount++;
    } catch (err: any) {
      failCount++;
      if (!firstErrorMsg) {
        firstErrorMsg = err.message || `Failed to sync ${repo.fullName}`;
      }
      console.error(`Background sync failed for repository ${repo.fullName} (${repo.id}):`, err);
    }
  }

  // Determine overall status
  let overallStatus = "healthy";
  let statusErrorMsg: string | null = null;

  if (failCount > 0) {
    if (successCount === 0) {
      overallStatus = "failing";
      statusErrorMsg = `All runs failed. Latest error: ${firstErrorMsg}`;
    } else {
      overallStatus = "degraded";
      statusErrorMsg = `${failCount} of ${eligibleRepos.length} repositories failed to sync. Latest error: ${firstErrorMsg}`;
    }
  }

  // Update BackgroundSyncStatus
  await db.backgroundSyncStatus.update({
    where: { id: "singleton" },
    data: {
      status: overallStatus,
      lastRunAt: new Date(),
      errorMsg: statusErrorMsg,
    },
  });

  // Run log cleanup
  await pruneLogs(30);

  return {
    success: failCount === 0,
    reposSynced: eligibleRepos.length,
    successCount,
    failCount,
    message: statusErrorMsg || "Background synchronization job completed successfully.",
  };
}
