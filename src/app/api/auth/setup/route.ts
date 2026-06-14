import { NextRequest, NextResponse } from "next/server";
import { execute, insertAndReturnId, queryOne } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { seedBuiltinWorkflows } from "@/lib/seed-workflows";

const MIN_PASSWORD_LENGTH = 10;

// GET: Check if setup is needed (no users exist)
export async function GET() {
  const result = await queryOne<{ count: number | string }>(
    "SELECT COUNT(*) AS count FROM users",
  );
  return NextResponse.json({ needsSetup: Number(result?.count ?? 0) === 0 });
}

// POST: Create first superuser
export async function POST(req: NextRequest) {
  // Throttle the first-run endpoint by IP.
  const limit = rateLimit(clientKey(req, "setup"), {
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMITED",
          message: "너무 많은 시도입니다. 잠시 후 다시 시도하세요.",
        },
      },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) },
      },
    );
  }

  // Check no users exist
  const result = await queryOne<{ count: number | string }>(
    "SELECT COUNT(*) AS count FROM users",
  );
  if (Number(result?.count ?? 0) > 0) {
    return NextResponse.json(
      { error: "Setup already completed." },
      { status: 409 },
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

  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.` },
      { status: 400 },
    );
  }

  const hash = await hashPassword(password);

  // Conditional insert collapses the check-then-act window (the bcrypt hash above
  // widened it): only inserts when the users table is still empty. If another
  // concurrent first-run won the race, no row is inserted → 409.
  const inserted = await execute(
    `INSERT INTO users (username, email, password_hash, role)
     SELECT $1, $2, $3, 'superuser'
     WHERE NOT EXISTS (SELECT 1 FROM users)`,
    [username, email, hash],
  );
  if (inserted.rowCount === 0) {
    return NextResponse.json(
      { error: "Setup already completed." },
      { status: 409 },
    );
  }
  const createdRow = await queryOne<{ id: number }>(
    "SELECT id FROM users WHERE email = $1",
    [email],
  );
  const userId = createdRow!.id;

  // Create default folder for the superuser
  const folderId = await insertAndReturnId(
    `INSERT INTO folders (name, description, owner_id, visibility, is_system)
     VALUES ('My Workspace', 'Your personal workspace.', $1, 'personal', true)
    `,
    [userId],
  );

  // Seed built-in workflows
  await seedBuiltinWorkflows(userId, folderId).catch((err) => {
    console.error("[seed] built-in workflow seeding failed:", err);
  });

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
