import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Mock/default workspaces list for wizard selection
    const workspaces = [
      {
        id: "jira-cloud-org-1",
        name: "Acme Engineering Jira Cloud",
        url: "https://acme-engineering.atlassian.net",
        projects: [
          { id: "10000", key: "AUTH", name: "Authentication & Security" },
          { id: "10001", key: "PAY", name: "Payments System" },
          { id: "10002", key: "CORE", name: "Core Platform" },
        ],
      },
    ];

    return NextResponse.json({ workspaces });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch Jira workspaces" }, { status: 500 });
  }
}
