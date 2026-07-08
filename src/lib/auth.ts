import { NextAuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { db } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
      authorization: {
        params: {
          scope: "read:user user:email repo",
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

  // 1. Direct ownership in database
  if (repo.userId === userId) return repo;

  // 2. Check if user is the owner of the repo on GitHub
  const githubLogin = await getUserGithubLogin(userId);
  if (githubLogin && repo.owner.toLowerCase() === githubLogin.toLowerCase()) {
    return repo;
  }

  return null;
}

