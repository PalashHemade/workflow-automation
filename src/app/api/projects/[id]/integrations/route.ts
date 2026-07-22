import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { IntegrationProvider } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const integrations = await db.projectIntegration.findMany({
      where: { engineeringProjectId: params.id },
      include: { credentials: true },
    });

    return NextResponse.json({ integrations });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch integrations" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { provider, config, accessToken, refreshToken } = body;

    if (!provider) {
      return NextResponse.json({ error: "Provider is required" }, { status: 400 });
    }

    const integration = await db.projectIntegration.upsert({
      where: {
        engineeringProjectId_provider: {
          engineeringProjectId: params.id,
          provider: provider as IntegrationProvider,
        },
      },
      create: {
        engineeringProjectId: params.id,
        provider: provider as IntegrationProvider,
        status: "CONNECTED",
        config: config || {},
      },
      update: {
        status: "CONNECTED",
        config: config || {},
      },
    });

    if (accessToken) {
      await db.oAuthCredential.create({
        data: {
          integrationId: integration.id,
          provider: provider as IntegrationProvider,
          accessToken,
          refreshToken,
        },
      });
    }

    return NextResponse.json({ integration });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to add integration" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const provider = searchParams.get("provider");

    if (!provider) {
      return NextResponse.json({ error: "Provider param is required" }, { status: 400 });
    }

    await db.projectIntegration.delete({
      where: {
        engineeringProjectId_provider: {
          engineeringProjectId: params.id,
          provider: provider as IntegrationProvider,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete integration" }, { status: 500 });
  }
}
