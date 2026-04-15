import { NextRequest, NextResponse } from "next/server";
import { errorResponse, execute, okResponse, query, queryOne } from "@/lib/db";
import { hashPassword, verifyPassword, type Role, type User } from "@/lib/auth";
import { withAuth } from "@/lib/with-auth";
import { deleteUser, type DeleteMode } from "@/lib/delete-user";

type Params = { params: Promise<{ id: string }> };

type UserPublic = {
  id: number;
  username: string;
  email: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
};

type AssignableRole = Exclude<Role, "superuser">;

const ALLOWED_ROLES: AssignableRole[] = ["admin", "editor", "viewer"];

function toPublicUser(user: User): UserPublic {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    is_active: user.is_active,
    created_at: user.created_at,
  };
}

function parseId(raw: string): number | null {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export const GET = withAuth(
  "users:read",
  async (_request: NextRequest, _user: User, { params }: Params) => {
    void _request;
    void _user;

    const { id } = await params;
    const userId = parseId(id);

    if (!userId) {
      const res = errorResponse("VALIDATION_ERROR", "invalid id", 400);
      return NextResponse.json(res.body, { status: res.status });
    }

    const row = await queryOne<User>("SELECT * FROM users WHERE id = $1", [
      userId,
    ]);
    if (!row) {
      const res = errorResponse("NOT_FOUND", "user not found", 404);
      return NextResponse.json(res.body, { status: res.status });
    }

    const res = okResponse(toPublicUser(row));
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const PUT = withAuth(
  "users:write",
  async (request: NextRequest, _user: User, { params }: Params) => {
    void _user;

    const { id } = await params;
    const userId = parseId(id);

    if (!userId) {
      const res = errorResponse("VALIDATION_ERROR", "invalid id", 400);
      return NextResponse.json(res.body, { status: res.status });
    }

    const existing = await queryOne<User>("SELECT * FROM users WHERE id = $1", [
      userId,
    ]);
    if (!existing) {
      const res = errorResponse("NOT_FOUND", "user not found", 404);
      return NextResponse.json(res.body, { status: res.status });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const { username, email, role, is_active, password } = body;

    let usernameValue = existing.username;
    if (username !== undefined) {
      if (typeof username !== "string" || !username.trim()) {
        const res = errorResponse(
          "VALIDATION_ERROR",
          "username must be a non-empty string",
          400,
        );
        return NextResponse.json(res.body, { status: res.status });
      }
      usernameValue = username.trim();
    }

    let emailValue = existing.email;
    if (email !== undefined) {
      if (email === null) {
        emailValue = null;
      } else if (typeof email === "string") {
        emailValue = email.trim() ? email.trim() : null;
      } else {
        const res = errorResponse(
          "VALIDATION_ERROR",
          "email must be a string or null",
          400,
        );
        return NextResponse.json(res.body, { status: res.status });
      }
    }

    let roleValue: AssignableRole = existing.role as AssignableRole;
    if (role !== undefined) {
      if (typeof role !== "string") {
        const res = errorResponse(
          "VALIDATION_ERROR",
          "role must be a string",
          400,
        );
        return NextResponse.json(res.body, { status: res.status });
      }
      if (role === "superuser") {
        const res = errorResponse(
          "VALIDATION_ERROR",
          "cannot assign superuser via API",
          400,
        );
        return NextResponse.json(res.body, { status: res.status });
      }
      if (!ALLOWED_ROLES.includes(role as AssignableRole)) {
        const res = errorResponse(
          "VALIDATION_ERROR",
          `role must be one of: ${ALLOWED_ROLES.join(", ")}`,
          400,
        );
        return NextResponse.json(res.body, { status: res.status });
      }
      roleValue = role as AssignableRole;
    }

    let isActiveValue = existing.is_active;
    if (is_active !== undefined) {
      if (typeof is_active !== "boolean") {
        const res = errorResponse(
          "VALIDATION_ERROR",
          "is_active must be a boolean",
          400,
        );
        return NextResponse.json(res.body, { status: res.status });
      }
      isActiveValue = is_active;
    }

    let passwordHashValue = existing.password_hash;
    if (password !== undefined) {
      if (typeof password !== "string" || !password.trim()) {
        const res = errorResponse(
          "VALIDATION_ERROR",
          "password must be a non-empty string",
          400,
        );
        return NextResponse.json(res.body, { status: res.status });
      }
      passwordHashValue = await hashPassword(password);
    }

    if (usernameValue !== existing.username) {
      const conflict = await queryOne<{ id: number }>(
        "SELECT id FROM users WHERE username = $1 AND id <> $2",
        [usernameValue, userId],
      );
      if (conflict) {
        const res = errorResponse("CONFLICT", "username already exists", 409);
        return NextResponse.json(res.body, { status: res.status });
      }
    }

    if (emailValue && emailValue !== existing.email) {
      const conflict = await queryOne<{ id: number }>(
        "SELECT id FROM users WHERE email = $1 AND id <> $2",
        [emailValue, userId],
      );
      if (conflict) {
        const res = errorResponse("CONFLICT", "email already exists", 409);
        return NextResponse.json(res.body, { status: res.status });
      }
    }

    await execute(
      "UPDATE users SET username = $1, email = $2, role = $3, is_active = $4, password_hash = $5, updated_at = $6 WHERE id = $7",
      [
        usernameValue,
        emailValue,
        roleValue,
        isActiveValue,
        passwordHashValue,
        new Date().toISOString(),
        userId,
      ],
    );

    const updated = await queryOne<User>("SELECT * FROM users WHERE id = $1", [
      userId,
    ]);

    const res = okResponse(updated ? toPublicUser(updated) : null);
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const DELETE = withAuth(
  "apikeys:read_own", // lowest permission — we do manual auth checks below
  async (request: NextRequest, caller: User, { params }: Params) => {
    const { id } = await params;
    const userId = parseId(id);

    if (!userId) {
      const res = errorResponse("VALIDATION_ERROR", "invalid id", 400);
      return NextResponse.json(res.body, { status: res.status });
    }

    const target = await queryOne<User>("SELECT * FROM users WHERE id = $1", [
      userId,
    ]);
    if (!target) {
      const res = errorResponse("NOT_FOUND", "user not found", 404);
      return NextResponse.json(res.body, { status: res.status });
    }

    // Superuser accounts cannot be deleted
    if (target.role === "superuser") {
      const res = errorResponse("FORBIDDEN", "cannot delete superuser", 403);
      return NextResponse.json(res.body, { status: res.status });
    }

    const isSelf = caller.id === userId;

    // Permission: self-delete allowed for anyone, admin+ can delete lower roles
    if (!isSelf) {
      const roleLevel: Record<string, number> = {
        viewer: 0,
        editor: 1,
        admin: 2,
        superuser: 3,
      };
      const callerLevel = roleLevel[caller.role] ?? 0;
      const targetLevel = roleLevel[target.role] ?? 0;
      if (callerLevel < 2 || callerLevel <= targetLevel) {
        const res = errorResponse("FORBIDDEN", "forbidden", 403);
        return NextResponse.json(res.body, { status: res.status });
      }
    }

    const body = (await request.json()) as Record<string, unknown>;
    const mode = body.mode as DeleteMode | undefined;
    const transferTo = body.transfer_to as number | undefined;
    const password = body.password as string | undefined;

    if (!mode || !["transfer", "delete_all"].includes(mode)) {
      const res = errorResponse(
        "VALIDATION_ERROR",
        "mode must be 'transfer' or 'delete_all'",
        400,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    // Self-delete requires password verification
    if (isSelf) {
      if (!password) {
        const res = errorResponse(
          "VALIDATION_ERROR",
          "password required for self-delete",
          400,
        );
        return NextResponse.json(res.body, { status: res.status });
      }
      const valid = await verifyPassword(password, target.password_hash);
      if (!valid) {
        const res = errorResponse("FORBIDDEN", "invalid password", 403);
        return NextResponse.json(res.body, { status: res.status });
      }
    }

    // Transfer mode validation
    if (mode === "transfer") {
      if (!transferTo) {
        const res = errorResponse(
          "VALIDATION_ERROR",
          "transfer_to is required for transfer mode",
          400,
        );
        return NextResponse.json(res.body, { status: res.status });
      }
      if (transferTo === userId) {
        const res = errorResponse(
          "VALIDATION_ERROR",
          "cannot transfer to self",
          400,
        );
        return NextResponse.json(res.body, { status: res.status });
      }
      const recipient = await queryOne<{ id: number; is_active: boolean }>(
        "SELECT id, is_active FROM users WHERE id = $1",
        [transferTo],
      );
      if (!recipient || !recipient.is_active) {
        const res = errorResponse(
          "VALIDATION_ERROR",
          "transfer target not found or inactive",
          400,
        );
        return NextResponse.json(res.body, { status: res.status });
      }
    }

    await deleteUser({ userId, mode, transferTo });

    const res = okResponse({ id: userId, deleted: true });
    return NextResponse.json(res.body, { status: res.status });
  },
);
