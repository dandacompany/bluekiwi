import { NextRequest, NextResponse } from "next/server";

import { authenticateRequest, hasPermission, type User } from "@/lib/auth";
import { errorResponse, execute, query } from "@/lib/db";
import { verifySession } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = await requireInviteAdmin(request);
  if (user instanceof NextResponse) {
    return user;
  }

  const { id } = await params;
  const result = await execute(
    `DELETE FROM invites WHERE id = $1 AND accepted_at IS NULL`,
    [Number(id)],
  );

  if (!result.rowCount) {
    return NextResponse.json(
      { error: "not_found_or_accepted" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}

async function requireInviteAdmin(
  request: NextRequest,
): Promise<User | NextResponse> {
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const auth = await authenticateRequest(authHeader);
    if (!auth) {
      const res = errorResponse("UNAUTHORIZED", "Unauthorized", 401);
      return NextResponse.json(res.body, { status: res.status });
    }
    if (!hasPermission(auth.user.role, "admin")) {
      const res = errorResponse("FORBIDDEN", "Forbidden", 403);
      return NextResponse.json(res.body, { status: res.status });
    }
    return auth.user;
  }

  const sessionToken = request.cookies.get("session")?.value;
  if (!sessionToken) {
    const res = errorResponse("UNAUTHORIZED", "Unauthorized", 401);
    return NextResponse.json(res.body, { status: res.status });
  }

  const session = await verifySession(sessionToken);
  if (!session) {
    const res = errorResponse("UNAUTHORIZED", "Unauthorized", 401);
    return NextResponse.json(res.body, { status: res.status });
  }

  const users = await query<User>(
    `SELECT * FROM users WHERE id = $1 AND is_active = true`,
    [session.userId],
  );
  const user = users[0];

  if (!user) {
    const res = errorResponse("UNAUTHORIZED", "Unauthorized", 401);
    return NextResponse.json(res.body, { status: res.status });
  }

  if (!hasPermission(user.role, "admin")) {
    const res = errorResponse("FORBIDDEN", "Forbidden", 403);
    return NextResponse.json(res.body, { status: res.status });
  }

  return user;
}
