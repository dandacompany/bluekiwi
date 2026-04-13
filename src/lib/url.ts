import { NextRequest } from "next/server";

/**
 * Resolve the public origin (scheme + host) for this request.
 *
 * Priority:
 *  1. PUBLIC_URL env var (explicit override)
 *  2. x-forwarded-host / x-forwarded-proto headers (reverse proxy)
 *  3. Host header
 *  4. fallback: http://localhost:3100
 */
export function resolveOrigin(request: NextRequest): string {
  const envUrl = process.env.PUBLIC_URL;
  if (envUrl) return envUrl.replace(/\/+$/, "");

  const fwdHost = request.headers.get("x-forwarded-host");
  const host = fwdHost || request.headers.get("host");
  if (!host) return "http://localhost:3100";

  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  return `${proto}://${host}`;
}
