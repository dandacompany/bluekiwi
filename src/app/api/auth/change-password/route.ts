import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryOne, execute } from "@/lib/db";
import { verifyPassword, hashPassword } from "@/lib/auth";
import { createSession, verifySession } from "@/lib/session";

interface UserRow {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  role: string;
  must_change_password: boolean;
}

export async function POST(req: NextRequest) {
  // 1. Verify session from cookie
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const session = await verifySession(token);
  if (!session) {
    return NextResponse.json(
      { error: "세션이 만료되었습니다. 다시 로그인해주세요." },
      { status: 401 },
    );
  }

  // 2. Parse request body
  const body = await req.json();
  const { current_password, new_password } = body;

  if (!current_password || !new_password) {
    return NextResponse.json(
      { error: "현재 비밀번호와 새 비밀번호를 입력해주세요." },
      { status: 400 },
    );
  }

  if (new_password.length < 6) {
    return NextResponse.json(
      { error: "새 비밀번호는 최소 6자 이상이어야 합니다." },
      { status: 400 },
    );
  }

  // 3. Fetch user from DB
  const user = await queryOne<UserRow>(
    "SELECT id, username, email, password_hash, role, must_change_password FROM users WHERE id = $1",
    [session.userId],
  );

  if (!user) {
    return NextResponse.json(
      { error: "사용자를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  // 4. Verify current password
  const valid = await verifyPassword(current_password, user.password_hash);
  if (!valid) {
    return NextResponse.json(
      { error: "현재 비밀번호가 올바르지 않습니다." },
      { status: 401 },
    );
  }

  // 5. Hash new password and update DB
  const newHash = await hashPassword(new_password);
  await execute(
    "UPDATE users SET password_hash = $1, must_change_password = false, updated_at = $2 WHERE id = $3",
    [newHash, new Date().toISOString(), user.id],
  );

  // 6. Issue new session token with mustChangePassword = false
  const newToken = await createSession({
    userId: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    mustChangePassword: false,
  });

  const response = NextResponse.json({ success: true });
  response.cookies.set("session", newToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return response;
}
