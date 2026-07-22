import { TestResult, TEST_USER_ID, TEST_ACCOUNT_ID, assert, assertEqual } from "../utils";
import { getUserGithubLogin, checkRepositoryAccess } from "@/lib/auth";
import { db } from "@/lib/db";

export async function runAuthUnitTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  const runTest = async (name: string, fn: () => Promise<void>) => {
    const startTime = Date.now();
    try {
      await fn();
      results.push({ name, passed: true, durationMs: Date.now() - startTime });
    } catch (err: any) {
      results.push({
        name,
        passed: false,
        durationMs: Date.now() - startTime,
        error: err.message || String(err),
      });
    }
  };

  await runTest("getUserGithubLogin returns null when account has no access token", async () => {
    // Save original providerAccountId and access_token to restore later
    const originalAccount = await db.account.findUnique({
      where: { id: TEST_ACCOUNT_ID },
    });
    const originalToken = originalAccount?.access_token;
    const originalProviderAccountId = originalAccount?.providerAccountId || "99999999";

    const tempProviderAccountId = "99999911";

    // Update account with a unique providerAccountId and remove access token
    await db.account.update({
      where: { id: TEST_ACCOUNT_ID },
      data: {
        providerAccountId: tempProviderAccountId,
        access_token: null,
      },
    });

    try {
      // Ensure no leftover contributor exists for this temp ID
      await db.contributor.deleteMany({
        where: { githubId: BigInt(tempProviderAccountId) },
      });

      const login = await getUserGithubLogin(TEST_USER_ID);
      assertEqual(login, null, "Should return null when access token is not set");
    } finally {
      // Restore original values
      await db.account.update({
        where: { id: TEST_ACCOUNT_ID },
        data: {
          providerAccountId: originalProviderAccountId,
          access_token: originalToken,
        },
      });
    }
  });

  await runTest("getUserGithubLogin resolves via Contributor cache", async () => {
    const originalAccount = await db.account.findUnique({
      where: { id: TEST_ACCOUNT_ID },
    });
    const originalProviderAccountId = originalAccount?.providerAccountId || "99999999";

    const tempProviderAccountId = "99999922";
    const mockLogin = "val-contributor-login-unique";

    // Set temp providerAccountId
    await db.account.update({
      where: { id: TEST_ACCOUNT_ID },
      data: { providerAccountId: tempProviderAccountId },
    });

    // Create the contributor in cache
    const contributor = await db.contributor.create({
      data: {
        githubId: BigInt(tempProviderAccountId),
        login: mockLogin,
        name: "Validation Contributor Unique",
      },
    });

    try {
      const resolvedLogin = await getUserGithubLogin(TEST_USER_ID);
      assertEqual(resolvedLogin, mockLogin, "Should resolve using contributor record cached login");
    } finally {
      // Cleanup contributor
      await db.contributor.delete({
        where: { id: contributor.id },
      });
      // Restore providerAccountId
      await db.account.update({
        where: { id: TEST_ACCOUNT_ID },
        data: { providerAccountId: originalProviderAccountId },
      });
    }
  });

  await runTest("checkRepositoryAccess denies access to unrelated user", async () => {
    // Create a temporary unrelated user to satisfy foreign key constraints
    const unrelatedUser = await db.user.create({
      data: {
        id: "val-unrelated-user-id",
        email: "unrelated@gitinsight.test",
        name: "Unrelated User",
      },
    });

    try {
      // Create a temporary repository owned by another user
      const repo = await db.repository.create({
        data: {
          githubId: BigInt("9999999"),
          name: "unrelated-repo",
          owner: "unrelated-owner",
          fullName: "unrelated-owner/unrelated-repo",
          htmlUrl: "https://github.com/unrelated-owner/unrelated-repo",
          userId: unrelatedUser.id,
          isTracked: true,
        },
      });

      try {
        const accessRepo = await checkRepositoryAccess(repo.id, TEST_USER_ID);
        assertEqual(accessRepo, null, "Should return null indicating access denied");
      } finally {
        // Cleanup repo
        await db.repository.delete({
          where: { id: repo.id },
        });
      }
    } finally {
      // Cleanup unrelated user
      await db.user.delete({
        where: { id: unrelatedUser.id },
      });
    }
  });

  await runTest("checkRepositoryAccess grants access to tracking/associated user", async () => {
    // Create a repo where TEST_USER_ID is the owner
    const repo = await db.repository.create({
      data: {
        githubId: BigInt("8888888"),
        name: "owned-repo",
        owner: "val-owner",
        fullName: "val-owner/owned-repo",
        htmlUrl: "https://github.com/val-owner/owned-repo",
        userId: TEST_USER_ID,
        isTracked: true,
      },
    });

    try {
      const accessRepo = await checkRepositoryAccess(repo.id, TEST_USER_ID);
      assert(accessRepo !== null, "Should return the repository details indicating access is granted");
      assertEqual(accessRepo.id, repo.id, "Returned repository should match created repository");
    } finally {
      // Cleanup repo
      await db.repository.delete({
        where: { id: repo.id },
      });
    }
  });

  return results;
}
