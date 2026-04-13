import { NextRequest, NextResponse } from "next/server";

import {
  generateApiKey,
  hashPassword,
  verifyPassword,
  type Role,
} from "@/lib/auth";
import { errorResponse, execute, queryOne, withTransaction } from "@/lib/db";
import { isExpired } from "@/lib/invites";
import { seedBuiltinWorkflows } from "@/lib/seed-workflows";
import { resolveOrigin } from "@/lib/url";

type Params = { params: Promise<{ token: string }> };

type InviteRow = {
  id: number;
  token: string;
  email: string;
  role: Role;
  accepted_at: string | null;
  expires_at: string;
  created_by_name: string | null;
};

type CreatedUser = {
  id: number;
  username: string;
  email: string | null;
  role: Role;
};

export async function GET(_request: NextRequest, { params }: Params) {
  const { token } = await params;
  const invite = await loadInvite(token);

  if (!invite) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (invite.accepted_at) {
    return NextResponse.json({ error: "already_accepted" }, { status: 410 });
  }

  if (isExpired(new Date(invite.expires_at))) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }

  return NextResponse.json({
    email: invite.email,
    role: invite.role,
    inviter: invite.created_by_name,
    expires_at: invite.expires_at,
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { token } = await params;
  const body = (await request.json()) as {
    username?: unknown;
    password?: unknown;
  };

  if (
    typeof body.username !== "string" ||
    !body.username.trim() ||
    typeof body.password !== "string" ||
    !body.password.trim()
  ) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const invite = await loadInvite(token);
  if (!invite) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (invite.accepted_at) {
    // Already accepted via web — if the user exists, issue a new API key for CLI
    const existingUser = await queryOne<{
      id: number;
      username: string;
      email: string | null;
      role: Role;
      password_hash: string;
    }>(
      `SELECT id, username, email, role, password_hash FROM users WHERE email = $1`,
      [invite.email],
    );

    if (existingUser && body.password && typeof body.password === "string") {
      const valid = await verifyPassword(
        body.password.trim(),
        existingUser.password_hash,
      );
      if (!valid) {
        return NextResponse.json(
          { error: "invalid_password" },
          { status: 403 },
        );
      }

      const { rawKey, prefix, keyHash } = generateApiKey();
      await execute(
        `INSERT INTO api_keys (user_id, key_hash, prefix, name) VALUES ($1, $2, $3, $4)`,
        [existingUser.id, keyHash, prefix, "bluekiwi-cli"],
      );

      return NextResponse.json({
        api_key: rawKey,
        server_url: resolveOrigin(request),
        server_version: process.env.BLUEKIWI_VERSION ?? "0.0.0-dev",
        user: {
          id: existingUser.id,
          username: existingUser.username,
          email: existingUser.email,
          role: existingUser.role,
        },
      });
    }

    return NextResponse.json({ error: "already_accepted" }, { status: 410 });
  }
  if (isExpired(new Date(invite.expires_at))) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }

  const username = body.username.trim();
  const password = body.password.trim();

  const existingUsername = await queryOne<{ id: number }>(
    `SELECT id FROM users WHERE username = $1`,
    [username],
  );
  if (existingUsername) {
    const res = errorResponse("CONFLICT", "username already exists", 409);
    return NextResponse.json(res.body, { status: res.status });
  }

  const existingEmail = await queryOne<{ id: number }>(
    `SELECT id FROM users WHERE email = $1`,
    [invite.email],
  );
  if (existingEmail) {
    const res = errorResponse("CONFLICT", "email already exists", 409);
    return NextResponse.json(res.body, { status: res.status });
  }

  const passwordHash = await hashPassword(password);
  const { rawKey, prefix, keyHash } = generateApiKey();

  const { user: created, folderId } = await withTransaction(async (client) => {
    const { rows: userRows } = await client.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, email, role`,
      [username, invite.email, passwordHash, invite.role],
    );
    const user = userRows[0] as CreatedUser;

    await client.query(
      `INSERT INTO api_keys (user_id, key_hash, prefix, name)
       VALUES ($1, $2, $3, $4)`,
      [user.id, keyHash, prefix, "bluekiwi-cli"],
    );

    // Create default "My Workspace" folder for the new user
    const { rows: folderRows } = await client.query<{ id: number }>(
      `INSERT INTO folders (name, description, owner_id, visibility, is_system)
       VALUES ('My Workspace', 'Your personal workspace.', $1, 'personal', true)
       RETURNING id`,
      [user.id],
    );

    await client.query(
      `UPDATE invites SET accepted_at = NOW(), accepted_by = $1 WHERE id = $2`,
      [user.id, invite.id],
    );

    return { user, folderId: folderRows[0].id };
  });

  // Seed built-in workflows (best-effort, same as setup)
  await seedBuiltinWorkflows(created.id, folderId).catch((err) => {
    console.error("[seed] built-in workflow seeding failed:", err);
  });

  return NextResponse.json({
    api_key: rawKey,
    server_url: resolveOrigin(request),
    server_version: process.env.BLUEKIWI_VERSION ?? "0.0.0-dev",
    user: created,
  });
}

async function loadInvite(token: string): Promise<InviteRow | undefined> {
  return queryOne<InviteRow>(
    `SELECT i.id, i.token, i.email, i.role, i.accepted_at, i.expires_at,
            u.username AS created_by_name
       FROM invites i
       LEFT JOIN users u ON u.id = i.created_by
      WHERE i.token = $1`,
    [token],
  );
}
