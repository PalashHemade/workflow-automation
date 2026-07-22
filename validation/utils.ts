import { db } from "@/lib/db";

export const VALIDATION_BASE_URL = process.env.VALIDATION_BASE_URL || "http://localhost:3000";

export const TEST_USER_ID = "val-user-id";
export const TEST_SESSION_TOKEN = "val-session-token";
export const TEST_ACCOUNT_ID = "val-account-id";

export interface TestResult {
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
}

export interface TestSuiteResult {
  suiteName: string;
  passed: number;
  failed: number;
  durationMs: number;
  tests: TestResult[];
}

/**
 * Inserts a temporary test user, github account, and NextAuth session in the DB.
 */
export async function setupTestContext() {
  console.log("Setting up database test context...");
  await teardownTestContext(); // Cleanup any leftovers first

  // 1. Create temporary User
  const user = await db.user.create({
    data: {
      id: TEST_USER_ID,
      name: "Validation Test User",
      email: "validation@gitinsight.test",
    },
  });

  // Find a real account in the DB to reuse its token for real API calls if possible
  const realAccount = await db.account.findFirst({
    where: { provider: "github", access_token: { not: null } },
  });
  const tokenToUse = realAccount?.access_token || process.env.GITHUB_ACCESS_TOKEN || "mock-val-github-token";
  const providerAccountId = "99999999";

  // 2. Create temporary GitHub Account
  await db.account.create({
    data: {
      id: TEST_ACCOUNT_ID,
      userId: TEST_USER_ID,
      type: "oauth",
      provider: "github",
      providerAccountId,
      access_token: tokenToUse,
      token_type: "bearer",
      scope: "read:user user:email repo",
    },
  });

  // 3. Create temporary NextAuth Session
  const session = await db.session.create({
    data: {
      userId: TEST_USER_ID,
      sessionToken: TEST_SESSION_TOKEN,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours expiry
    },
  });

  console.log(`Test user, account, and session created successfully.`);
  return { user, session };
}

/**
 * Cleans up all validation database records by cascade-deleting the test user.
 */
export async function teardownTestContext() {
  try {
    const user = await db.user.findUnique({
      where: { id: TEST_USER_ID },
    });
    if (user) {
      console.log("Cleaning up database test context (cascade deleting test user)...");
      await db.user.delete({
        where: { id: TEST_USER_ID },
      });
      console.log("Database test context cleaned up successfully.");
    }
  } catch (err) {
    console.error("Error during database teardown:", err);
  }
}

/**
 * Standard HTTP fetch helper targeting the validation server.
 */
export async function testFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = path.startsWith("http") ? path : `${VALIDATION_BASE_URL}${path}`;
  return fetch(url, options);
}

/**
 * Helper to perform authenticated API calls using the injected session cookie.
 */
export async function testFetchAuth(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set("Cookie", `next-auth.session-token=${TEST_SESSION_TOKEN}`);
  
  return testFetch(path, {
    ...options,
    headers,
  });
}

// ASSERTION HELPERS
export function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

export function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message || "Assertion failed"}: expected ${expected}, got ${actual}`);
  }
}

export async function assertThrows(fn: () => any, message: string) {
  try {
    await fn();
  } catch (err) {
    return; // Succeeded (threw an error)
  }
  throw new Error(message || "Expected function to throw, but it succeeded");
}

export function assertIncludes(actual: string, expectedSubstr: string, message: string) {
  if (!actual.includes(expectedSubstr)) {
    throw new Error(`${message || "Assertion failed"}: expected "${actual}" to include "${expectedSubstr}"`);
  }
}
