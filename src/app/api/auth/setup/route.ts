import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { createSession } from "@/lib/session";

// GET: Check if setup is needed (no users exist)
export async function GET() {
  const result = await queryOne<{ count: number }>(
    "SELECT COUNT(*)::int AS count FROM users",
  );
  return NextResponse.json({ needsSetup: (result?.count ?? 0) === 0 });
}

// POST: Create first superuser
export async function POST(req: NextRequest) {
  // Check no users exist
  const result = await queryOne<{ count: number }>(
    "SELECT COUNT(*)::int AS count FROM users",
  );
  if ((result?.count ?? 0) > 0) {
    return NextResponse.json(
      { error: "Setup already completed." },
      { status: 403 },
    );
  }

  const body = await req.json();
  const { username, email, password } = body;

  if (!username || !email || !password) {
    return NextResponse.json(
      { error: "모든 필드를 입력해주세요." },
      { status: 400 },
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "비밀번호는 6자 이상이어야 합니다." },
      { status: 400 },
    );
  }

  const hash = await hashPassword(password);

  const rows = await query<{ id: number }>(
    "INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, 'superuser') RETURNING id",
    [username, email, hash],
  );

  const userId = rows[0].id;

  const token = await createSession({
    userId,
    username,
    email,
    role: "superuser",
    mustChangePassword: false,
  });

  const response = NextResponse.json({ success: true });
  response.cookies.set("session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return response;
}
