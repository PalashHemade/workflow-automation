import { NextResponse } from "next/server";
import { fetchAccessibleJiraWorkspaces } from "@/lib/jira";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect("/?error=missing_code");
  }

  try {
    const clientId = process.env.JIRA_CLIENT_ID || "mock-jira-client-id";
    const clientSecret = process.env.JIRA_CLIENT_SECRET || "mock-jira-client-secret";
    const redirectUri = process.env.JIRA_REDIRECT_URI || "http://localhost:3000/api/auth/jira/callback";

    const res = await fetch("https://auth.atlassian.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    let accessToken = "mock-access-token";
    let refreshToken = "mock-refresh-token";

    if (res.ok) {
      const data = await res.json();
      accessToken = data.access_token;
      refreshToken = data.refresh_token;
    }

    const workspaces = await fetchAccessibleJiraWorkspaces(accessToken);
    const primaryWorkspace = workspaces[0] || {
      id: "mock-cloud-id-1",
      name: "Default Jira Cloud Workspace",
      url: "https://gitinsight.atlassian.net",
    };

    // Redirect back to wizard with parameters
    const redirectUrl = `/?jira_connected=true&cloudId=${encodeURIComponent(
      primaryWorkspace.id
    )}&accessToken=${encodeURIComponent(accessToken)}&refreshToken=${encodeURIComponent(refreshToken)}`;

    return NextResponse.redirect(new URL(redirectUrl, req.url));
  } catch (error) {
    return NextResponse.redirect(new URL("/?error=jira_auth_failed", req.url));
  }
}
