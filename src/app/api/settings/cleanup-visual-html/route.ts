import { NextRequest, NextResponse } from "next/server";

import { errorResponse, execute, queryOne } from "@/lib/db";
import { requireAuth } from "@/lib/with-auth";

async function requireSuperuser(request: NextRequest) {
  const authResult = await requireAuth(request, "users:read");
  if (authResult instanceof NextResponse) return authResult;

  if (authResult.role !== "superuser") {
    const res = errorResponse("FORBIDDEN", "Forbidden", 403);
    return NextResponse.json(res.body, { status: res.status });
  }

  return authResult;
}

export async function GET(request: NextRequest) {
  const authResult = await requireSuperuser(request);
  if (authResult instanceof NextResponse) return authResult;

  const row = await queryOne<{ affected: number }>(
    `SELECT COUNT(*)::int AS affected
       FROM task_logs
      WHERE task_id IN (
        SELECT id FROM tasks WHERE status IN ('completed', 'failed')
      )
        AND visual_html IS NOT NULL`,
  );

  return NextResponse.json({ affected: row?.affected ?? 0 });
}

export async function POST(request: NextRequest) {
  const authResult = await requireSuperuser(request);
  if (authResult instanceof NextResponse) return authResult;

  const result = await execute(
    `UPDATE task_logs
        SET visual_html = NULL
      WHERE task_id IN (
        SELECT id FROM tasks WHERE status IN ('completed', 'failed')
      )
        AND visual_html IS NOT NULL`,
  );

  return NextResponse.json({ cleared: result.rowCount });
}
