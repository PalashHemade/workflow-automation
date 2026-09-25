import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth";
import { removeRepositoryFromProject } from "@/lib/project/projectService";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request, { params }: { params: { id: string; repoId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await removeRepositoryFromProject(params.id, params.repoId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to remove repository from project" }, { status: 400 });
  }
}
