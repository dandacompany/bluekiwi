import { NextRequest, NextResponse } from "next/server";
import { findLoginUserByEmail } from "@/lib/db/repositories/auth";
import { verifyPassword } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { resolveOrigin } from "@/lib/url";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json(
      { error: "이메일과 비밀번호를 입력해주세요." },
      { status: 400 },
    );
  }

  const user = await findLoginUserByEmail(email);

  if (!user || !user.password_hash) {
    return NextResponse.json(
      { error: "이메일 또는 비밀번호가 올바르지 않습니다." },
      { status: 401 },
    );
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return NextResponse.json(
      { error: "이메일 또는 비밀번호가 올바르지 않습니다." },
      { status: 401 },
    );
  }

  const token = await createSession({
    userId: user.id,
    username: user.username,
    email: user.email ?? email,
    role: user.role,
    mustChangePassword: user.must_change_password,
  });

  const response = NextResponse.json({
    success: true,
    must_change_password: user.must_change_password,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
  });
  response.cookies.set("session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: resolveOrigin(req).startsWith("https://"),
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return response;
}
