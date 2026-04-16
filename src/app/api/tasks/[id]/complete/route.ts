import { NextRequest, NextResponse } from "next/server";
import { query, execute, okResponse, errorResponse } from "@/lib/db";
import { notifyTaskUpdate } from "@/lib/notify-ws";
import { requireAuth } from "@/lib/with-auth";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const authResult = await requireAuth(request, "tasks:execute");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const taskId = Number(id);
  const body = await request.json();
  const { status, summary } = body;

  if (!status || !["completed", "failed"].includes(status)) {
    const res = errorResponse(
      "VALIDATION_ERROR",
      "status must be 'completed' or 'failed'",
      400,
    );
    return NextResponse.json(res.body, { status: res.status });
  }

  const result = await execute(
    "UPDATE tasks SET status = $1, summary = $2, updated_at = $3 WHERE id = $4",
    [status, summary ?? "", new Date().toISOString(), taskId],
  );

  // 미완료 로그 정리
  await execute(
    "UPDATE task_logs SET status = 'cancelled', completed_at = $2 WHERE task_id = $1 AND status IN ('pending', 'running')",
    [taskId, new Date().toISOString()],
  );

  if (result.rowCount === 0) {
    const res = errorResponse("NOT_FOUND", "태스크를 찾을 수 없습니다", 404);
    return NextResponse.json(res.body, { status: res.status });
  }

  const logs = await query<{
    step_order: number;
    status: string;
    output: string;
  }>(
    "SELECT step_order, status, output FROM task_logs WHERE task_id = $1 ORDER BY step_order ASC",
    [taskId],
  );

  void notifyTaskUpdate(taskId, status);
  const res = okResponse({
    task_id: taskId,
    status,
    steps_completed: logs.length,
    logs,
  });
  return NextResponse.json(res.body, { status: res.status });
}
