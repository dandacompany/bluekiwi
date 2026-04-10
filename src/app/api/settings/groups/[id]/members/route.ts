import { NextResponse } from "next/server";
import {
  query,
  execute,
  okResponse,
  listResponse,
  errorResponse,
} from "@/lib/db";
import { withAuth } from "@/lib/with-auth";

type Params = { params: Promise<{ id: string }> };

export const GET = withAuth<Params>(
  "users:read",
  async (_request, _user, { params }: Params) => {
    const { id } = await params;
    const rows = await query(
      `SELECT u.id, u.username FROM users u
         JOIN user_group_members ugm ON ugm.user_id = u.id
         WHERE ugm.group_id = $1 ORDER BY u.username`,
      [Number(id)],
    );
    const res = listResponse(rows, rows.length);
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const POST = withAuth<Params>(
  "users:write",
  async (request, _user, { params }: Params) => {
    const { id } = await params;
    const body = await request.json();
    const userId: unknown = body.user_id;
    if (typeof userId !== "number") {
      const res = errorResponse("VALIDATION_ERROR", "user_id required", 400);
      return NextResponse.json(res.body, { status: res.status });
    }
    await execute(
      "INSERT INTO user_group_members (user_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [userId, Number(id)],
    );
    const res = okResponse({ added: true });
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const DELETE = withAuth<Params>(
  "users:write",
  async (request, _user, { params }: Params) => {
    const { id } = await params;
    const body = await request.json();
    const userId: unknown = body.user_id;
    if (typeof userId !== "number") {
      const res = errorResponse("VALIDATION_ERROR", "user_id required", 400);
      return NextResponse.json(res.body, { status: res.status });
    }
    await execute(
      "DELETE FROM user_group_members WHERE user_id = $1 AND group_id = $2",
      [userId, Number(id)],
    );
    const res = okResponse({ removed: true });
    return NextResponse.json(res.body, { status: res.status });
  },
);
