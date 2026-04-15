import { NextRequest, NextResponse } from "next/server";
import {
  insertAndReturnId,
  listResponse,
  okResponse,
  query,
  queryOne,
  errorResponse,
} from "@/lib/db";
import { hashPassword, type Role } from "@/lib/auth";
import { withAuth } from "@/lib/with-auth";

type UserPublic = {
  id: number;
  username: string;
  email: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
};

type CreatableRole = Exclude<Role, "superuser">;

const ALLOWED_CREATE_ROLES: CreatableRole[] = ["admin", "editor", "viewer"];

export const GET = withAuth("users:read", async () => {
  const users = await query<UserPublic>(
    "SELECT id, username, email, role, is_active, created_at FROM users ORDER BY created_at DESC",
  );

  const res = listResponse(users, users.length);
  return NextResponse.json(res.body, { status: res.status });
});

export const POST = withAuth("users:write", async (request: NextRequest) => {
  const body = (await request.json()) as Record<string, unknown>;
  const username = body.username;
  const email = body.email;
  const password = body.password;
  const role = body.role;

  if (typeof username !== "string" || !username.trim()) {
    const res = errorResponse("VALIDATION_ERROR", "username is required", 400);
    return NextResponse.json(res.body, { status: res.status });
  }

  if (typeof password !== "string" || !password.trim()) {
    const res = errorResponse("VALIDATION_ERROR", "password is required", 400);
    return NextResponse.json(res.body, { status: res.status });
  }

  let emailValue: string | null = null;
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

  let roleValue: CreatableRole = "viewer";
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
        "cannot create superuser via API",
        400,
      );
      return NextResponse.json(res.body, { status: res.status });
    }
    if (!ALLOWED_CREATE_ROLES.includes(role as CreatableRole)) {
      const res = errorResponse(
        "VALIDATION_ERROR",
        `role must be one of: ${ALLOWED_CREATE_ROLES.join(", ")}`,
        400,
      );
      return NextResponse.json(res.body, { status: res.status });
    }
    roleValue = role as CreatableRole;
  }

  const usernameValue = username.trim();

  const existingByUsername = await queryOne<{ id: number }>(
    "SELECT id FROM users WHERE username = $1",
    [usernameValue],
  );
  if (existingByUsername) {
    const res = errorResponse("CONFLICT", "username already exists", 409);
    return NextResponse.json(res.body, { status: res.status });
  }

  if (emailValue) {
    const existingByEmail = await queryOne<{ id: number }>(
      "SELECT id FROM users WHERE email = $1",
      [emailValue],
    );
    if (existingByEmail) {
      const res = errorResponse("CONFLICT", "email already exists", 409);
      return NextResponse.json(res.body, { status: res.status });
    }
  }

  const passwordHash = await hashPassword(password);

  const userId = await insertAndReturnId(
    "INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4)",
    [usernameValue, emailValue, passwordHash, roleValue],
  );

  const created = await queryOne<UserPublic>(
    "SELECT id, username, email, role, is_active, created_at FROM users WHERE id = $1",
    [userId],
  );

  const res = okResponse(created ?? null, 201);
  return NextResponse.json(res.body, { status: res.status });
});
