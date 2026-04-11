import { NextRequest, NextResponse } from "next/server";
import { errorResponse, queryOne } from "./db";
import {
  authenticateRequest,
  checkPermission,
  type Permission,
  type User,
} from "./auth";
import { verifySession } from "./session";

type Handler = (
  request: NextRequest,
  user: User,
  context: unknown,
) => NextResponse | Promise<NextResponse>;

export function withAuth(
  permission: Permission,
  handler: (
    request: NextRequest,
    user: User,
  ) => NextResponse | Promise<NextResponse>,
): (request: NextRequest) => Promise<NextResponse>;
export function withAuth<C>(
  permission: Permission,
  handler: (
    request: NextRequest,
    user: User,
    context: C,
  ) => NextResponse | Promise<NextResponse>,
): (request: NextRequest, context: C) => Promise<NextResponse>;
export function withAuth(
  permission: Permission,
  handler:
    | Handler
    | ((
        request: NextRequest,
        user: User,
      ) => NextResponse | Promise<NextResponse>),
) {
  return async (
    request: NextRequest,
    context?: unknown,
  ): Promise<NextResponse> => {
    const authHeader = request.headers.get("authorization");
    let user: User | null = null;

    if (authHeader) {
      const auth = await authenticateRequest(authHeader);
      user = auth?.user ?? null;
    } else {
      // Fallback: session cookie (web UI and first-time API key minting)
      const token = request.cookies.get("session")?.value;
      if (token) {
        const session = await verifySession(token);
        if (session) {
          user = await queryOne<User>(
            "SELECT * FROM users WHERE id = $1 AND is_active = true",
            [session.userId],
          );
        }
      }
    }

    if (!user) {
      const res = errorResponse("UNAUTHORIZED", "Unauthorized", 401);
      return NextResponse.json(res.body, { status: res.status });
    }

    if (!checkPermission(user.role, permission)) {
      const res = errorResponse("FORBIDDEN", "Forbidden", 403);
      return NextResponse.json(res.body, { status: res.status });
    }

    const authedHandler = handler as Handler;
    return authedHandler(request, user, context);
  };
}

/**
 * Optional auth wrapper — if API key is present, validate and check permission.
 * If no API key header, pass through with user=null (backward compatible with web UI).
 */
type OptionalHandler = (
  request: NextRequest,
  user: User | null,
  context: unknown,
) => NextResponse | Promise<NextResponse>;

export function withOptionalAuth(
  permission: Permission,
  handler: (
    request: NextRequest,
    user: User | null,
  ) => NextResponse | Promise<NextResponse>,
): (request: NextRequest) => Promise<NextResponse>;
export function withOptionalAuth<C>(
  permission: Permission,
  handler: (
    request: NextRequest,
    user: User | null,
    context: C,
  ) => NextResponse | Promise<NextResponse>,
): (request: NextRequest, context: C) => Promise<NextResponse>;
export function withOptionalAuth(
  permission: Permission,
  handler:
    | OptionalHandler
    | ((
        request: NextRequest,
        user: User | null,
      ) => NextResponse | Promise<NextResponse>),
) {
  return async (
    request: NextRequest,
    context?: unknown,
  ): Promise<NextResponse> => {
    const authHeader = request.headers.get("authorization");

    // No auth header → pass through (web UI compatibility)
    if (!authHeader) {
      const optHandler = handler as OptionalHandler;
      return optHandler(request, null, context);
    }

    const auth = await authenticateRequest(authHeader);
    if (!auth) {
      const res = errorResponse("UNAUTHORIZED", "Unauthorized", 401);
      return NextResponse.json(res.body, { status: res.status });
    }

    if (!checkPermission(auth.user.role, permission)) {
      const res = errorResponse("FORBIDDEN", "Forbidden", 403);
      return NextResponse.json(res.body, { status: res.status });
    }

    const optHandler = handler as OptionalHandler;
    return optHandler(request, auth.user, context);
  };
}
