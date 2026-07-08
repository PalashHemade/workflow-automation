import { NextRequest, NextResponse } from "next/server";
import { runStatelessSyncJob } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

/**
 * GET or POST: Trigger stateless background polling sync
 */
async function handler(req: NextRequest) {
  try {
    // Optional CRON_SECRET security check
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = req.headers.get("authorization");
      const urlToken = new URL(req.url).searchParams.get("key");
      
      if (
        authHeader !== `Bearer ${cronSecret}` &&
        urlToken !== cronSecret
      ) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    console.log("Stateless sync cron job triggered...");
    const result = await runStatelessSyncJob();

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Cron job runtime error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}

export { handler as GET, handler as POST };
