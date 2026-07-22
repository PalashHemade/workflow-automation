import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAIQueryData } from "@/lib/projectAnalytics";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const insights = await db.aIInsight.findMany({
      where: { engineeringProjectId: params.id },
      orderBy: { createdAt: "desc" },
    });

    const aiQueryData = await getAIQueryData(params.id);

    return NextResponse.json({ insights, aiQueryData });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch AI insights" }, { status: 500 });
  }
}
