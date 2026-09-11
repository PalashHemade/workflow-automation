import { NextAuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { db } from "@/lib/db";
import { issueTokenPair, revokeUserTokens } from "@/lib/tokenService";
import { cookies } from "next/headers";

// ─── Cookie helpers ───────────────────────────────────────────────────────────

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export function setTokenCookies(
  accessToken: string,
  refreshToken: string,
  accessTokenExpiresAt: Date,
  refreshTokenExpiresAt: Date
) {
  const jar = cookies();
  jar.set("app_access_token", accessToken, {
    ...COOKIE_OPTS,
    expires: accessTokenExpiresAt,
  });
  jar.set("app_refresh_token", refreshToken, {
    ...COOKIE_OPTS,
    expires: refreshTokenExpiresAt,
  });
}

export function clearTokenCookies() {
  const jar = cookies();
  jar.delete("app_access_token");
  jar.delete("app_refresh_token");
}

// ─── Auth Options ─────────────────────────────────────────────────────────────

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
      authorization: {
        params: {
          scope: "read:user user:email repo",
          // "consent" forces GitHub to show the grant screen after OAuth revocation.
          // "login" forces GitHub to always ask for credentials (no silent SSO).
          prompt: "login consent",
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        // @ts-ignore
        session.user.id = user.id;
      }
      return session;
    },
    /**
     * Force-save the GitHub access_token every sign-in.
     * The PrismaAdapter's updateAccount is unreliable when the column is NULL,
     * so we do it ourselves here to guarantee it's always populated.
     */
    async signIn({ user, account }) {
      if (account?.provider === "github" && account.access_token && user.id) {
        try {
          await db.account.updateMany({
            where: { userId: user.id, provider: "github" },
            data: {
              access_token: account.access_token,
              refresh_token: account.refresh_token ?? null,
              expires_at: account.expires_at ?? null,
              scope: account.scope ?? null,
            },
          });
        } catch (err) {
          console.error("[auth] Failed to persist GitHub access_token:", err);
        }
      }
      return true;
    },
  },
  events: {
    /**
     * After a successful GitHub login, issue a fresh access+refresh token pair
     * and set them as httpOnly cookies on the response.
     */
    async signIn({ user }) {
      if (!user.id) return;
      try {
        const { accessToken, refreshToken, accessTokenExpiresAt, refreshTokenExpiresAt } =
          await issueTokenPair(user.id);
        setTokenCookies(accessToken, refreshToken, accessTokenExpiresAt, refreshTokenExpiresAt);
      } catch (err) {
        console.error("[auth] Failed to issue token pair on signIn:", err);
      }
    },

    /**
     * On sign-out:
     * 1. Delete the custom token pair from the DB.
     * 2. Revoke the GitHub OAuth token via GitHub's API so GitHub
     *    requires full re-authorization on the next login.
     * 3. Clear the httpOnly cookies.
     */
    async signOut({ session }) {
      // With PrismaAdapter, session is the raw DB Session row (has `userId`)
      const userId = (session as any)?.userId as string | undefined;
      if (!userId) return;

      // 1. Revoke custom tokens
      try {
        await revokeUserTokens(userId);
      } catch (err) {
        console.error("[auth] Failed to revoke user tokens on signOut:", err);
      }

      // 2. Revoke the GitHub OAuth access token so GitHub requires re-auth
      try {
        const account = await db.account.findFirst({
          where: { userId, provider: "github" },
        });
        if (account?.access_token) {
          const clientId = process.env.GITHUB_CLIENT_ID!;
          const clientSecret = process.env.GITHUB_CLIENT_SECRET!;
          const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

          await fetch(
            `https://api.github.com/applications/${clientId}/token`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Basic ${credentials}`,
                Accept: "application/vnd.github+json",
                "Content-Type": "application/json",
                "User-Agent": "github-analytics-dashboard",
              },
              body: JSON.stringify({ access_token: account.access_token }),
            }
          );
          // Note: do NOT null the access_token here — the PrismaAdapter's updateAccount
          // on the next sign-in does not reliably overwrite a null, causing the repo
          // list to appear empty. The GitHub-side revocation above is sufficient.
        }
      } catch (err) {
        console.error("[auth] Failed to revoke GitHub OAuth token on signOut:", err);
      }

      // 3. Clear httpOnly cookies
      try {
        clearTokenCookies();
      } catch {
        // cookies() may not be available in some edge cases; safe to ignore
      }
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/",
  },
};


/**
 * Retrieve the GitHub login/username for the given database user.
 */
export async function getUserGithubLogin(userId: string): Promise<string | null> {
  const account = await db.account.findFirst({
    where: { userId, provider: "github" },
  });

  if (!account) return null;

  const githubId = BigInt(account.providerAccountId);
  
  // 1. Try to find in the contributor table
  const contributor = await db.contributor.findUnique({
    where: { githubId },
  });

  if (contributor) {
    return contributor.login;
  }

  // 2. Fetch directly from GitHub API and cache it
  if (account.access_token) {
    try {
      const response = await fetch("https://api.github.com/user", {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${account.access_token}`,
          "User-Agent": "github-analytics-dashboard",
        },
        cache: "no-store",
      });
      if (response.ok) {
        const profile = await response.json();
        
        await db.contributor.upsert({
          where: { login: profile.login },
          update: { githubId },
          create: {
            login: profile.login,
            githubId,
            avatarUrl: profile.avatar_url,
            name: profile.name,
            email: profile.email,
          },
        });
        return profile.login;
      }
    } catch (err) {
      console.error("Error fetching github user profile:", err);
    }
  }

  return null;
}

/**
 * Verifies if a user has access to a repository.
 * Returns the Repository record if access is granted, or null if denied.
 */
export async function checkRepositoryAccess(
  repositoryId: string,
  userId: string
): Promise<any | null> {
  const repo = await db.repository.findUnique({
    where: { id: repositoryId },
    include: {
      webhook: true,
      user: {
        include: {
          accounts: true,
        },
      },
    },
  });

  if (!repo) return null;

  // 1. Direct ownership or tracking in database
  if (repo.userId === userId || repo.trackingUserIds.includes(`,${userId},`)) return repo;

  // 2. Check if user is the owner of the repo on GitHub
  const githubLogin = await getUserGithubLogin(userId);
  if (githubLogin && repo.owner.toLowerCase() === githubLogin.toLowerCase()) {
    return repo;
  }

  return null;
}

