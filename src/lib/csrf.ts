import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "./db";

/**
 * Defense-in-depth CSRF protection for cookie-authenticated mutations.
 *
 * The session cookie is `SameSite=Lax`, which already blocks the common
 * cross-site POST/PUT/DELETE vectors; this adds an explicit same-origin check.
 *
 * The check applies ONLY when a request both (a) uses an unsafe method and
 * (b) carries the session cookie and (c) does NOT carry an Authorization header.
 * API-key requests (Authorization: Bearer bk_…) are exempt — they are never sent
 * automatically by the browser and are used cross-origin by the CLI/MCP.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Pure decision core — easy to unit test. Returns true when the request should be blocked. */
export function isForbiddenCrossOrigin(input: {
  method: string;
  hasAuthHeader: boolean;
  hasSessionCookie: boolean;
  origin: string | null;
  referer: string | null;
  allowedHosts: Set<string>;
}): boolean {
  if (SAFE_METHODS.has(input.method.toUpperCase())) return false;
  if (input.hasAuthHeader) return false; // API-key auth is not CSRF-able
  if (!input.hasSessionCookie) return false; // nothing to forge against

  const candidate = input.origin ?? input.referer;
  // No Origin/Referer at all — be conservative and allow (non-browser client).
  // SameSite=Lax still guards the browser cross-site case.
  if (!candidate) return false;

  let host: string | null = null;
  try {
    host = new URL(candidate).host;
  } catch {
    host = null;
  }
  if (!host) return true; // malformed Origin/Referer on a cookie mutation → block
  return !input.allowedHosts.has(host);
}

function allowedHosts(request: NextRequest): Set<string> {
  const hosts = new Set<string>();
  const xfh = request.headers.get("x-forwarded-host");
  if (xfh) xfh.split(",").forEach((h) => hosts.add(h.trim()));
  const host = request.headers.get("host");
  if (host) hosts.add(host.trim());
  if (process.env.PUBLIC_URL) {
    try {
      hosts.add(new URL(process.env.PUBLIC_URL).host);
    } catch {
      // ignore malformed PUBLIC_URL
    }
  }
  return hosts;
}

/**
 * Returns a 403 NextResponse when the request is a cross-origin cookie-auth
 * mutation, otherwise null. Call at the top of mutating handlers / auth wrappers.
 */
export function csrfCheck(request: NextRequest): NextResponse | null {
  const forbidden = isForbiddenCrossOrigin({
    method: request.method,
    hasAuthHeader: Boolean(request.headers.get("authorization")),
    hasSessionCookie: Boolean(request.cookies.get("session")),
    origin: request.headers.get("origin"),
    referer: request.headers.get("referer"),
    allowedHosts: allowedHosts(request),
  });
  if (!forbidden) return null;
  const res = errorResponse(
    "CSRF_FAILED",
    "Cross-origin request blocked",
    403,
  );
  return NextResponse.json(res.body, { status: res.status });
}
