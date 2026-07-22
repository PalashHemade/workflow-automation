import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const clientId = process.env.JIRA_CLIENT_ID || "mock-jira-client-id";
  const redirectUri = process.env.JIRA_REDIRECT_URI || "http://localhost:3000/api/auth/jira/callback";
  const scope = "read:jira-work read:jira-user offline_access";

  const jiraAuthUrl = `https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id=${encodeURIComponent(
    clientId
  )}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&prompt=consent`;

  return NextResponse.redirect(jiraAuthUrl);
}
