"use client";

import { signOut } from "next-auth/react";

/**
 * Drop-in replacement for `fetch()` in client components.
 *
 * Behaviour:
 * 1. Makes the original request.
 * 2. If the response is 401 with { code: "TOKEN_EXPIRED" }:
 *    a. Calls POST /api/auth/refresh to rotate the token pair.
 *    b. If refresh succeeds, retries the original request once (new cookies
 *       are set automatically by the browser from the refresh response).
 *    c. If refresh fails (REFRESH_EXPIRED), calls signOut() and redirects to /.
 * 3. Any other 401 is returned as-is (caller decides what to do).
 *
 * Usage:
 *   import { fetchWithRefresh } from "@/lib/auth/fetchWithRefresh";
 *   const res = await fetchWithRefresh("/api/repos");
 */
export async function fetchWithRefresh(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  // First attempt
  const res = await fetch(input, { ...init, credentials: "include" });

  if (res.status !== 401) return res;

  // Parse the 401 body to check the error code
  let body: { code?: string } = {};
  try {
    body = await res.clone().json();
  } catch {
    return res; // Not JSON — return as-is
  }

  if (body.code !== "TOKEN_EXPIRED") return res;

  // ── Token expired: try to refresh ─────────────────────────────────────────
  const refreshRes = await fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "include",
  });

  if (!refreshRes.ok) {
    // Refresh token is expired/invalid → force full sign-out
    let refreshBody: { code?: string } = {};
    try {
      refreshBody = await refreshRes.json();
    } catch {}

    if (
      refreshBody.code === "REFRESH_EXPIRED" ||
      refreshRes.status === 401
    ) {
      await signOut({ callbackUrl: "/" });
    }

    return refreshRes;
  }

  // ── Refresh succeeded: retry the original request ─────────────────────────
  // The browser now has fresh httpOnly cookies set by /api/auth/refresh.
  return fetch(input, { ...init, credentials: "include" });
}
