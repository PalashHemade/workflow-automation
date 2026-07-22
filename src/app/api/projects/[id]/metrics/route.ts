import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { calculateProjectMetrics } from "@/lib/projectAnalytics";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const metrics = await calculateProjectMetrics(params.id);
    return NextResponse.json({ metrics });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch metrics" }, { status: 500 });
  }
}
