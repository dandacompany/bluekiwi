import { NextRequest, NextResponse } from "next/server";
import {
  queryOne,
  execute,
  okResponse,
  errorResponse,
  Task,
  WorkflowNode,
} from "@/lib/db";
import { notifyTaskUpdate } from "@/lib/notify-ws";
import { authenticateRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// 사람(UI)이 호출: 현재 스텝을 승인하여 advance 잠금 해제
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const taskId = Number(id);

  const auth = await authenticateRequest(request.headers.get("authorization"));
  if (!auth) {
    const res = errorResponse("UNAUTHORIZED", "인증이 필요합니다", 401);
    return NextResponse.json(res.body, { status: res.status });
  }
  const userId = auth.user.id;

  const task = await queryOne<Task>("SELECT * FROM tasks WHERE id = $1", [
    taskId,
  ]);
  if (!task) {
    const res = errorResponse("NOT_FOUND", "태스크를 찾을 수 없습니다", 404);
    return NextResponse.json(res.body, { status: res.status });
  }

  const currentNode = await queryOne<WorkflowNode>(
    "SELECT * FROM workflow_nodes WHERE workflow_id = $1 AND step_order = $2",
    [task.workflow_id, task.current_step],
  );
  if (!currentNode) {
    const res = errorResponse(
      "NOT_FOUND",
      "현재 스텝 노드를 찾을 수 없습니다",
      404,
    );
    return NextResponse.json(res.body, { status: res.status });
  }

  if (currentNode.auto_advance) {
    const res = errorResponse(
      "NOT_APPLICABLE",
      "이 단계는 auto_advance가 활성화되어 있어 수동 승인이 필요하지 않습니다",
      400,
    );
    return NextResponse.json(res.body, { status: res.status });
  }

  const log = await queryOne<{
    id: number;
    status: string;
    approved_at: string | null;
  }>(
    "SELECT id, status, approved_at FROM task_logs WHERE task_id = $1 AND step_order = $2 ORDER BY id DESC LIMIT 1",
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

  const COMPLETED_STATUSES = ["completed", "success", "skipped"];
  if (!COMPLETED_STATUSES.includes(log.status)) {
    const res = errorResponse(
      "PRECONDITION_FAILED",
      "에이전트가 아직 이 단계를 완료하지 않았습니다. 완료 후 승인 가능합니다.",
      412,
    );
    return NextResponse.json(res.body, { status: res.status });
  }

  if (log.approved_at) {
    const res = errorResponse(
      "ALREADY_APPROVED",
      "이 단계는 이미 승인되었습니다",
      409,
    );
    return NextResponse.json(res.body, { status: res.status });
  }

  await execute(
    "UPDATE task_logs SET approved_at = NOW(), approved_by = $1 WHERE id = $2",
    [userId, log.id],
  );

  void notifyTaskUpdate(taskId, "step_approved", {
    step_order: task.current_step,
    node_id: currentNode.id,
    approved_by: userId,
  });

  const res = okResponse({
    task_id: taskId,
    step_order: task.current_step,
    node_id: currentNode.id,
    approved: true,
    message: "승인 완료. 에이전트가 이제 다음 단계로 진행할 수 있습니다.",
  });
  return NextResponse.json(res.body, { status: res.status });
}
