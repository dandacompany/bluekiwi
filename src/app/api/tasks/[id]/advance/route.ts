import { NextRequest, NextResponse } from "next/server";
import {
  query,
  queryOne,
  execute,
  WorkflowNode,
  Task,
  TaskLog,
  maskSecrets,
  okResponse,
  errorResponse,
} from "@/lib/db";
import { notifyTaskUpdate } from "@/lib/notify-ws";
import { requireAuth } from "@/lib/with-auth";
import { canUseCredential } from "@/lib/authorization";
import type { User } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

async function resolveNodeResponse(node: WorkflowNode, user: User) {
  let instruction = node.instruction;
  if (node.instruction_id) {
    const inst = await queryOne<{ content: string }>(
      "SELECT content FROM instructions WHERE id = $1",
      [node.instruction_id],
    );
    if (inst) instruction = inst.content;
  }

  let credentials = null;
  if (node.credential_id) {
    const cred = await queryOne<{
      id: number;
      owner_id: number;
      folder_id: number;
      service_name: string;
      secrets: string;
    }>(
      "SELECT id, owner_id, folder_id, service_name, secrets FROM credentials WHERE id = $1",
      [node.credential_id],
    );
    if (cred && (await canUseCredential(user, cred))) {
      credentials = {
        service: cred.service_name,
        secrets_masked: maskSecrets(cred.secrets),
      };
    }
  }

  const attachments = await query<{
    id: number;
    filename: string;
    mime_type: string;
    size_bytes: number;
  }>(
    "SELECT id, filename, mime_type, size_bytes FROM node_attachments WHERE node_id = $1 ORDER BY created_at",
    [node.id],
  );

  return {
    node_id: node.id,
    step_order: node.step_order,
    node_type: node.node_type,
    title: node.title,
    instruction,
    hitl: node.hitl,
    loop_back_to: node.loop_back_to,
    credentials,
    attachments: attachments.length > 0 ? attachments : undefined,
  };
}

export async function POST(request: NextRequest, { params }: Params) {
  const authResult = await requireAuth(request, "tasks:execute");
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  const { id } = await params;
  const taskId = Number(id);
  const body = await request.json().catch(() => ({}));
  const peek = body.peek === true;

  const task = await queryOne<Task>("SELECT * FROM tasks WHERE id = $1", [
    taskId,
  ]);
  if (!task) {
    const res = errorResponse("NOT_FOUND", "태스크를 찾을 수 없습니다", 404);
    return NextResponse.json(res.body, { status: res.status });
  }

  // timed_out 태스크를 재개(peek)할 때 상태를 running으로 복구
  if (peek && task.status === "timed_out") {
    await execute(
      "UPDATE tasks SET status = 'running', updated_at = NOW() WHERE id = $1",
      [taskId],
    );
    task.status = "running";
    void notifyTaskUpdate(taskId, "task_resumed");
  }

  const totalRows = await queryOne<{ count: string }>(
    "SELECT COUNT(*) as count FROM workflow_nodes WHERE workflow_id = $1",
    [task.workflow_id],
  );
  const totalSteps = Number(totalRows?.count ?? 0);

  // Peek mode
  if (peek) {
    const currentNode = await queryOne<WorkflowNode>(
      "SELECT * FROM workflow_nodes WHERE workflow_id = $1 AND step_order = $2",
      [task.workflow_id, task.current_step],
    );

    let currentLog: TaskLog | undefined;
    if (currentNode) {
      currentLog = await queryOne<TaskLog>(
        "SELECT * FROM task_logs WHERE task_id = $1 AND node_id = $2 ORDER BY id DESC LIMIT 1",
        [taskId, currentNode.id],
      );
    }

    const comments = await query(
      "SELECT * FROM task_comments WHERE task_id = $1 AND step_order = $2 ORDER BY created_at DESC",
      [taskId, task.current_step],
    );

    const res = okResponse({
      task_id: taskId,
      current_step: task.current_step,
      total_steps: totalSteps,
      status: task.status,
      context: task.context,
      node: currentNode ? await resolveNodeResponse(currentNode, user) : null,
      log_status: currentLog?.status ?? null,
      web_response: currentLog?.web_response ?? null,
      comments: comments.length > 0 ? comments : null,
    });
    return NextResponse.json(res.body, { status: res.status });
  }

  // Advance mode: check current step is completed
  const currentNode = await queryOne<WorkflowNode>(
    "SELECT * FROM workflow_nodes WHERE workflow_id = $1 AND step_order = $2",
    [task.workflow_id, task.current_step],
  );

  if (currentNode) {
    const currentLog = await queryOne<{
      status: string;
      approved_at: string | null;
    }>(
      "SELECT status, approved_at FROM task_logs WHERE task_id = $1 AND node_id = $2 ORDER BY id DESC LIMIT 1",
      [taskId, currentNode.id],
    );
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
  const nextNode = await queryOne<WorkflowNode>(
    "SELECT * FROM workflow_nodes WHERE workflow_id = $1 AND step_order = $2",
    [task.workflow_id, nextStep],
  );

  if (!nextNode) {
    await execute(
      "UPDATE tasks SET status = 'completed', updated_at = NOW() WHERE id = $1",
      [taskId],
    );
    void notifyTaskUpdate(taskId, "task_completed");
    const res = okResponse({
      task_id: taskId,
      finished: true,
      message: "모든 단계가 완료되었습니다.",
    });
    return NextResponse.json(res.body, { status: res.status });
  }

  await execute(
    "UPDATE tasks SET current_step = $1, updated_at = NOW() WHERE id = $2",
    [nextStep, taskId],
  );
  void notifyTaskUpdate(taskId, "step_advanced", { current_step: nextStep });

  await execute(
    "INSERT INTO task_logs (task_id, node_id, step_order, status, node_title, node_type) VALUES ($1, $2, $3, 'pending', $4, $5)",
    [
      taskId,
      nextNode.id,
      nextNode.step_order,
      nextNode.title,
      nextNode.node_type,
    ],
  );

  const comments = await query(
    "SELECT * FROM task_comments WHERE task_id = $1 AND step_order = $2 ORDER BY created_at DESC",
    [taskId, nextStep],
  );

  const res = okResponse({
    task_id: taskId,
    finished: false,
    total_steps: totalSteps,
    context: task.context,
    current_step: await resolveNodeResponse(nextNode, user),
    comments: comments.length > 0 ? comments : null,
  });
  return NextResponse.json(res.body, { status: res.status });
}
