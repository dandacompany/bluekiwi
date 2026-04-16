import { NextRequest, NextResponse } from "next/server";
import { okResponse, errorResponse, type TaskLog } from "@/lib/db";
import { requireAuth } from "@/lib/with-auth";
import {
  advanceTaskToStep,
  completeTaskIfNoNextNode,
  findLatestTaskLogForNode,
  findTaskById,
  findTaskPeekLog,
  findWorkflowNodeByStep,
  getWorkflowTaskInfo,
  listTaskComments,
  maybeResumeTimedOutTask,
  resolveTaskNodeResponse,
} from "@/lib/db/repositories/tasks";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const authResult = await requireAuth(request, "tasks:execute");
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  const { id } = await params;
  const taskId = Number(id);
  const body = await request.json().catch(() => ({}));
  const peek = body.peek === true;

  let task = await findTaskById(taskId);
  if (!task) {
    const res = errorResponse("NOT_FOUND", "태스크를 찾을 수 없습니다", 404);
    return NextResponse.json(res.body, { status: res.status });
  }

  if (peek) {
    task = await maybeResumeTimedOutTask(task);
  }

  const wfInfo = await getWorkflowTaskInfo(task.workflow_id);
  const totalSteps = wfInfo.node_count;

  // Peek mode
  if (peek) {
    const currentNode = await findWorkflowNodeByStep(
      task.workflow_id,
      task.current_step,
    );

    let currentLog: TaskLog | undefined;
    if (currentNode) {
      currentLog = (await findTaskPeekLog(taskId, currentNode.id)) ?? undefined;
    }

    const comments = await listTaskComments(taskId, task.current_step);

    const res = okResponse({
      task_id: taskId,
      current_step: task.current_step,
      total_steps: totalSteps,
      status: task.status,
      context: task.context,
      node: currentNode
        ? await resolveTaskNodeResponse(currentNode, user)
        : null,
      log_status: currentLog?.status ?? null,
      web_response: currentLog?.web_response ?? null,
      comments: comments.length > 0 ? comments : null,
    });
    return NextResponse.json(res.body, { status: res.status });
  }

  // Advance mode: check current step is completed
  const currentNode = await findWorkflowNodeByStep(
    task.workflow_id,
    task.current_step,
  );

  if (currentNode) {
    const currentLog = await findLatestTaskLogForNode(taskId, currentNode.id);
    const COMPLETED_STATUSES = ["completed", "success", "skipped"];
    if (!currentLog || !COMPLETED_STATUSES.includes(currentLog.status)) {
      const res = errorResponse(
        "PRECONDITION_FAILED",
        `현재 스텝(${task.current_step})이 아직 완료되지 않았습니다`,
        412,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    // hitl=true인 action 단계는 사람의 명시적 승인 필요
    if (currentNode.hitl && !currentLog.approved_at) {
      const res = errorResponse(
        "MANUAL_APPROVAL_REQUIRED",
        `스텝 ${task.current_step}(${currentNode.title})은 수동 승인이 필요합니다. 사람이 승인한 후에 advance가 가능합니다.`,
        403,
      );
      return NextResponse.json(res.body, { status: res.status });
    }
  }

  // Move to next step
  const nextStep = task.current_step + 1;
  const nextNode = await findWorkflowNodeByStep(task.workflow_id, nextStep);

  if (!nextNode) {
    await completeTaskIfNoNextNode(taskId);
    const res = okResponse({
      task_id: taskId,
      finished: true,
      message: "모든 단계가 완료되었습니다.",
    });
    return NextResponse.json(res.body, { status: res.status });
  }

  await advanceTaskToStep({ taskId, nextNode });

  const comments = await listTaskComments(taskId, nextStep);

  const res = okResponse({
    task_id: taskId,
    finished: false,
    total_steps: totalSteps,
    context: task.context,
    current_step: await resolveTaskNodeResponse(nextNode, user),
    comments: comments.length > 0 ? comments : null,
  });
  return NextResponse.json(res.body, { status: res.status });
}
