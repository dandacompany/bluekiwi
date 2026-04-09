import { NextRequest, NextResponse } from "next/server";
import { errorResponse, execute, okResponse, queryOne } from "@/lib/db";
import { hashPassword, type Role, type User } from "@/lib/auth";
import { withAuth } from "@/lib/with-auth";

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
      "UPDATE users SET username = $1, email = $2, role = $3, is_active = $4, password_hash = $5, updated_at = NOW() WHERE id = $6",
      [
        usernameValue,
        emailValue,
        roleValue,
        isActiveValue,
        passwordHashValue,
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
  "users:write",
  async (_request: NextRequest, _user: User, { params }: Params) => {
    void _request;
    void _user;

    const { id } = await params;
    const userId = parseId(id);

    if (!userId) {
      const res = errorResponse("VALIDATION_ERROR", "invalid id", 400);
      return NextResponse.json(res.body, { status: res.status });
    }

    const result = await execute(
      "UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1",
      [userId],
    );

    if (result.rowCount === 0) {
      const res = errorResponse("NOT_FOUND", "user not found", 404);
      return NextResponse.json(res.body, { status: res.status });
    }

    const res = okResponse({ id: userId, is_active: false });
    return NextResponse.json(res.body, { status: res.status });
  },
);
