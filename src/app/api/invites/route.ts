import { NextRequest, NextResponse } from "next/server";

import { authenticateRequest, hasPermission, type User } from "@/lib/auth";
import { errorResponse, insertAndReturnId, query, queryOne } from "@/lib/db";
import {
  buildInviteUrl,
  generateInviteToken,
  inviteExpiresAt,
} from "@/lib/invites";
import { sendInviteEmail } from "@/lib/email";
import { resolveOrigin } from "@/lib/url";
import { verifySession } from "@/lib/session";

type InviteRecord = {
  id: number;
  token: string;
  email: string;
  role: string;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
  created_by_name: string | null;
};

export async function POST(request: NextRequest) {
  const user = await requireInviteAdmin(request);
  if (user instanceof NextResponse) {
    return user;
  }

  const { email, role, locale } = (await request.json()) as {
    email?: unknown;
    role?: unknown;
    locale?: unknown;
  };

  if (
    typeof email !== "string" ||
    !email.trim() ||
    typeof role !== "string" ||
    !["admin", "editor", "viewer"].includes(role)
  ) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const token = generateInviteToken();
  const expiresAt = inviteExpiresAt();
  const inviteId = await insertAndReturnId(
    `INSERT INTO invites (token, email, role, created_by, expires_at)
     VALUES ($1,$2,$3,$4,$5)`,
    [token, email.trim(), role, user.id, expiresAt],
  );
  const created = await queryOne<{
    id: number;
    token: string;
    expires_at: string;
    created_at: string;
  }>("SELECT id, token, expires_at, created_at FROM invites WHERE id = $1", [
    inviteId,
  ]);

  const publicUrl = resolveOrigin(request);
  const inviteUrl = buildInviteUrl(publicUrl, token);

  // Best-effort email — invite is created regardless of email result
  const emailResult = await sendInviteEmail({
    to: email.trim(),
    inviteUrl,
    role,
    inviterName: user.username,
    expiresAt: new Date(created?.expires_at ?? expiresAt),
    locale: typeof locale === "string" ? locale : "en",
  });

  return NextResponse.json({
    data: {
      id: created?.id ?? inviteId,
      token,
      expires_at: created?.expires_at ?? expiresAt,
      created_at: created?.created_at ?? new Date().toISOString(),
      url: inviteUrl,
      email_sent: emailResult.sent,
    },
  });
}

export async function GET(request: NextRequest) {
  const user = await requireInviteAdmin(request);
  if (user instanceof NextResponse) {
    return user;
  }

  const invites = await query<InviteRecord>(
    `SELECT i.id, i.token, i.email, i.role, i.accepted_at, i.expires_at, i.created_at,
            u.username AS created_by_name
       FROM invites i
       LEFT JOIN users u ON u.id = i.created_by
       ORDER BY i.created_at DESC`,
  );

  return NextResponse.json({ invites });
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
