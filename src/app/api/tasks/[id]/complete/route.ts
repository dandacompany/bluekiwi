import { NextRequest, NextResponse } from "next/server";
import { query, execute, okResponse, errorResponse } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
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
    "UPDATE tasks SET status = $1, summary = $2, updated_at = NOW() WHERE id = $3",
    [status, summary ?? "", taskId],
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

  const res = okResponse({
    task_id: taskId,
    status,
    steps_completed: logs.length,
    logs,
  });
  return NextResponse.json(res.body, { status: res.status });
}
