import { NextRequest, NextResponse } from "next/server";
import { queryOne, execute, okResponse, errorResponse } from "@/lib/db";
import { requireAuth } from "@/lib/with-auth";
import { findTaskById } from "@/lib/db/repositories/tasks";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const authResult = await requireAuth(request, "tasks:execute");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const taskId = Number(id);
  const body = await request.json();
  const { node_id, progress } = body;

  if (!node_id || !progress) {
    const res = errorResponse(
      "VALIDATION_ERROR",
      "node_id and progress are required",
      400,
    );
    return NextResponse.json(res.body, { status: res.status });
  }

  const task = await findTaskById(taskId);

  // 태스크가 취소된 경우
  if (task?.status === "cancelled") {
    const res = okResponse({
      success: true,
      task_id: taskId,
      node_id,
      cancelled: true,
    });
    return NextResponse.json(res.body, { status: res.status });
  }

  // 이 node의 최신 로그 상태 확인
  const latestLog = await queryOne<{
    id: number;
    status: string;
    output: string;
  }>(
    "SELECT id, status, output FROM task_logs WHERE task_id = $1 AND node_id = $2 ORDER BY id DESC LIMIT 1",
    [taskId, node_id],
  );

  // 되감기로 인해 해당 스텝 로그가 cancelled된 경우
  if (!latestLog || latestLog.status === "cancelled") {
    const res = okResponse({
      success: true,
      task_id: taskId,
      node_id,
      rewound: true,
      current_step: task?.current_step ?? null,
    });
    return NextResponse.json(res.body, { status: res.status });
  }

  // 정상: progress 기록
  const updated = latestLog.output
    ? `${latestLog.output}\n${progress}`
    : progress;
  await execute("UPDATE task_logs SET output = $1 WHERE id = $2", [
    updated,
    latestLog.id,
  ]);

  await execute("UPDATE tasks SET updated_at = $2 WHERE id = $1", [
    taskId,
    new Date().toISOString(),
  ]);

  const res = okResponse({ success: true, task_id: taskId, node_id });
  return NextResponse.json(res.body, { status: res.status });
}
