import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const knowledge = await db.projectKnowledge.findUnique({
      where: { engineeringProjectId: params.id },
    });

    const moduleKnowledge = await db.moduleKnowledge.findMany({
      where: { engineeringProjectId: params.id },
    });

    return NextResponse.json({ knowledge, moduleKnowledge });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch knowledge" }, { status: 500 });
  }
}
