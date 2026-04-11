import { NextRequest, NextResponse } from "next/server";
import { queryOne, execute, okResponse, errorResponse, Task } from "@/lib/db";
import { notifyTaskUpdate } from "@/lib/notify-ws";

type Params = { params: Promise<{ id: string }> };

// 에이전트가 호출: "나는 준비됐으니 사람이 승인해 주세요"
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const taskId = Number(id);
  const body = await request.json().catch(() => ({}));
  const message: string = body.message ?? "";

  const task = await queryOne<Task>("SELECT * FROM tasks WHERE id = $1", [
    taskId,
  ]);
  if (!task) {
    const res = errorResponse("NOT_FOUND", "태스크를 찾을 수 없습니다", 404);
    return NextResponse.json(res.body, { status: res.status });
  }

  // 현재 스텝의 task_log에 approval_requested_at 기록
  const log = await queryOne<{ id: number; node_id: number }>(
    "SELECT id, node_id FROM task_logs WHERE task_id = $1 AND step_order = $2 ORDER BY id DESC LIMIT 1",
    [taskId, task.current_step],
  );
  if (!log) {
    const res = errorResponse(
      "NOT_FOUND",
      "현재 스텝에 대한 실행 로그를 찾을 수 없습니다",
      404,
    );
    return NextResponse.json(res.body, { status: res.status });
  }

  await execute(
    "UPDATE task_logs SET approval_requested_at = NOW() WHERE id = $1",
    [log.id],
  );

  void notifyTaskUpdate(taskId, "approval_requested", {
    step_order: task.current_step,
    node_id: log.node_id,
    message,
  });

  const res = okResponse({
    task_id: taskId,
    step_order: task.current_step,
    node_id: log.node_id,
    approval_requested: true,
    message: "승인 요청이 전송되었습니다. 사람이 승인할 때까지 대기하세요.",
  });
  return NextResponse.json(res.body, { status: res.status });
}
