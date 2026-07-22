import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUnifiedTimeline } from "@/lib/projectTimeline";
import { IntegrationProvider, EventEntityType, EventImportance } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const provider = searchParams.get("provider") as IntegrationProvider | undefined;
    const entityType = searchParams.get("entityType") as EventEntityType | undefined;
    const importance = searchParams.get("importance") as EventImportance | undefined;
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const timeline = await getUnifiedTimeline({
      projectId: params.id,
      provider: provider || undefined,
      entityType: entityType || undefined,
      importance: importance || undefined,
      limit,
    });

    return NextResponse.json(timeline);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch events" }, { status: 500 });
  }
}
