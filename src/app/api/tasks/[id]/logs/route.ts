import { NextRequest, NextResponse } from "next/server";
import {
  query,
  queryOne,
  insert,
  execute,
  TaskLog,
  okResponse,
  errorResponse,
} from "@/lib/db";
import { requireAuth } from "@/lib/with-auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const authResult = await requireAuth(request, "tasks:read");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const logs = await query<TaskLog>(
    "SELECT * FROM task_logs WHERE task_id = $1 ORDER BY step_order ASC",
    [Number(id)],
  );

  return NextResponse.json({ data: logs, total: logs.length });
}

export async function POST(request: NextRequest, { params }: Params) {
  const authResult = await requireAuth(request, "tasks:execute");
  if (authResult instanceof NextResponse) return authResult;
  const { id } = await params;
  const body = await request.json();
  const { node_id, step_order, output, status } = body;

  if (!node_id || !step_order) {
    const res = errorResponse(
      "VALIDATION_ERROR",
      "node_id and step_order are required",
      400,
    );
    return NextResponse.json(res.body, { status: res.status });
  }

  const logId = await insert(
    "INSERT INTO task_logs (task_id, node_id, step_order, status, output) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [
      Number(id),
      Number(node_id),
      Number(step_order),
      status ?? "running",
      (output ?? "").trim(),
    ],
  );

  // 태스크의 current_step 업데이트
  await execute(
    "UPDATE tasks SET current_step = $1, updated_at = NOW() WHERE id = $2",
    [Number(step_order), Number(id)],
  );

  const log = await queryOne<TaskLog>("SELECT * FROM task_logs WHERE id = $1", [
    logId,
  ]);
  const res = okResponse(log, 201);
  return NextResponse.json(res.body, { status: res.status });
}
