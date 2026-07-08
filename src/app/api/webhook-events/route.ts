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


    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit")) || 20));
    const skip = (page - 1) * limit;

    const total = await db.webhookEvent.count({ where: { repositoryId } });
    const events = await db.webhookEvent.findMany({
      where: { repositoryId },
      orderBy: { processedAt: "desc" },
      skip,
      take: limit,
    });

    return NextResponse.json({
      events,
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
