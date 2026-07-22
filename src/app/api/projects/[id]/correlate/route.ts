import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { correlateProject, manuallyCorrelateItem } from "@/lib/correlationEngine";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    if (body.storyId && (body.commitId || body.pullRequestId)) {
      await manuallyCorrelateItem({
        storyId: body.storyId,
        commitId: body.commitId,
        pullRequestId: body.pullRequestId,
        reason: body.reason,
      });
      return NextResponse.json({ success: true, message: "Item manually correlated successfully" });
    }

    // Default: run auto correlation
    const result = await correlateProject(params.id);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Correlation failed" }, { status: 500 });
  }
}
