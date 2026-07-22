import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getEngineeringProjectById, deleteEngineeringProject } from "@/lib/projectService";

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

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const project = await getEngineeringProjectById(params.id);
    if (!project) {
      return NextResponse.json({ error: "Engineering Project not found" }, { status: 404 });
    }

    return safeJsonResponse({ project });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch project" }, { status: 500 });
  }
}


export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await deleteEngineeringProject(params.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete project" }, { status: 500 });
  }
}
