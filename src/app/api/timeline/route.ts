import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions, checkRepositoryAccess } from "@/lib/auth";
import { EventEntityType, EventImportance } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/timeline
 * Retrieve paginated, filtered repository activities sorted by newest first.
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate user
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const repositoryId = searchParams.get("repositoryId");

    if (!repositoryId) {
      return NextResponse.json({ error: "Missing repositoryId query parameter" }, { status: 400 });
    }

    // 2. Verify repository ownership
    const repository = await checkRepositoryAccess(repositoryId, session.user.id);

    if (!repository) {
      return NextResponse.json({ error: "Forbidden or Repository not found" }, { status: 403 });
    }

    // 3. Parse query parameters
    const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit")) || 15));
    const cursor = searchParams.get("cursor"); // event ID for cursor pagination
    const entityTypesRaw = searchParams.get("eventTypes") || searchParams.get("entityTypes");
    const actor = searchParams.get("actor")?.trim();
    const importanceRaw = searchParams.get("importance");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search")?.trim();

    // 4. Construct Where clause
    const where: any = {
      repositoryId,
    };

    if (entityTypesRaw) {
      const types = entityTypesRaw
        .split(",")
        .map((t) => t.trim() as EventEntityType)
        .filter((t) => Object.values(EventEntityType).includes(t));
      if (types.length > 0) {
        where.entityType = { in: types };
      }
    }

    if (actor) {
      where.actorName = { contains: actor, mode: "insensitive" };
    }

    if (importanceRaw) {
      const importances = importanceRaw
        .split(",")
        .map((i) => i.trim() as EventImportance)
        .filter((i) => Object.values(EventImportance).includes(i));
      if (importances.length > 0) {
        where.importance = { in: importances };
      }
    }

    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate);
    }
    if (startDate || endDate) {
      where.createdAt = dateFilter;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { actorName: { contains: search, mode: "insensitive" } },
      ];
    }

    if (cursor) {
      const cursorEvent = await db.projectEvent.findUnique({
        where: { id: cursor },
        select: { createdAt: true, id: true },
      });

      if (cursorEvent) {
        where.AND = [
          ...(where.AND || []),
          {
            OR: [
              {
                createdAt: { lt: cursorEvent.createdAt },
              },
              {
                createdAt: cursorEvent.createdAt,
                id: { lt: cursorEvent.id },
              },
            ],
          },
        ];
      }
    }

    const events = await db.projectEvent.findMany({
      where,
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: limit + 1,
    });

    let nextCursor: string | null = null;
    const hasNextPage = events.length > limit;
    
    if (hasNextPage) {
      const nextItem = events[limit - 1];
      nextCursor = nextItem.id;
      events.pop();
    }

    return NextResponse.json({
      events,
      pagination: {
        nextCursor,
        limit,
      },
    });
  } catch (error: any) {
    console.error("Timeline API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
