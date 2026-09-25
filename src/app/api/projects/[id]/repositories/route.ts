import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth";
import { addRepositoryToProject } from "@/lib/project/projectService";

export const dynamic = "force-dynamic";

function safeJsonResponse(data: any, status = 200) {
  return new NextResponse(
    JSON.stringify(data, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
    {
      status,
      headers: { "Content-Type": "application/json" },
    }
  );
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { repositoryId, label } = body;

    if (!repositoryId) {
      return NextResponse.json({ error: "repositoryId is required" }, { status: 400 });
    }

    const link = await addRepositoryToProject(params.id, repositoryId, label);
    return safeJsonResponse({ link }, 201);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to add repository to project" }, { status: 400 });
  }
}
