import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { number: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const prNumber = Number(params.number);
    if (isNaN(prNumber)) {
      return NextResponse.json({ error: "Invalid PR number" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const repositoryId = searchParams.get("repositoryId");
    if (!repositoryId) {
      return NextResponse.json({ error: "Missing repositoryId" }, { status: 400 });
    }

    // Verify ownership
    const repo = await db.repository.findUnique({
      where: { id: repositoryId },
    });
    if (!repo || repo.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const pullRequest = await db.pullRequest.findFirst({
      where: { number: prNumber, repositoryId },
      include: {
        files: true,
        reviews: {
          orderBy: { submittedAt: "asc" },
          include: {
            comments: {
              orderBy: { createdAt: "asc" },
            },
          },
        },
        comments: {
          where: { reviewId: null }, // Orphan review comments (if any)
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!pullRequest) {
      return NextResponse.json({ error: "Pull Request not found" }, { status: 404 });
    }

    return NextResponse.json({
      pullRequest,
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}
