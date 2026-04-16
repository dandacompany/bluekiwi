import { NextRequest, NextResponse } from "next/server";
import { okResponse, errorResponse } from "@/lib/db";
import { notifyTaskUpdate } from "@/lib/notify-ws";
import {
  completeTaskLog,
  enqueueLoopContinuation,
  findExecutedNode,
  findPendingOrRunningTaskLog,
  mergeTaskRunningContext,
  resolveTaskProvider,
  saveTaskArtifacts,
  touchTaskUpdatedAt,
  upsertAgentRegistrySlug,
} from "@/lib/db/repositories/tasks";
import { requireAuth } from "@/lib/with-auth";
import { queryOne as dbQueryOne } from "@/lib/db";
import { findTaskById } from "@/lib/db/repositories/tasks";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const authResult = await requireAuth(request, "tasks:execute");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const taskId = Number(id);
  const body = await request.json();
  const {
    node_id,
    output,
    status,
    visual_html,
    loop_continue,
    context_snapshot,
    structured_output,
    artifacts,
    session_id,
    provider_slug,
    agent_id,
    user_name,
    model_slug,
    model_id,
  } = body;

  const resolvedModel = model_slug ?? model_id ?? null;

  if (!node_id || !output || !status) {
    const res = errorResponse(
      "VALIDATION_ERROR",
      "node_id, output, status are required",
      400,
    );
    return NextResponse.json(res.body, { status: res.status });
  }

  // Resolve provider: body value first, then inherit from task
  const bodyProvider = provider_slug ?? agent_id ?? null;
  let resolvedProvider = bodyProvider;
  if (!resolvedProvider) {
    resolvedProvider = await resolveTaskProvider(taskId);
  }

  // Find pending/running log
  const log = await findPendingOrRunningTaskLog({ taskId, nodeId: node_id });
  if (!log) {
    // 되감기로 인해 해당 로그가 cancelled됐는지 확인
    const cancelledLog = await dbQueryOne<{ id: number }>(
      "SELECT id FROM task_logs WHERE task_id = $1 AND node_id = $2 AND status = 'cancelled' ORDER BY id DESC LIMIT 1",
      [taskId, node_id],
    );
    if (cancelledLog) {
      const task = await findTaskById(taskId);
      const res = errorResponse(
        "STEP_REWOUND",
        `이 스텝은 웹 UI에서 되감기되어 취소되었습니다. advance(peek=true)로 현재 스텝(${task?.current_step ?? "?"}으로 이동)을 확인하고 재실행하세요.`,
        409,
      );
      return NextResponse.json(res.body, { status: res.status });
    }
    const res = errorResponse(
      "NOT_FOUND",
      `task_id=${taskId}, node_id=${node_id}에 대한 실행 중인 로그를 찾을 수 없습니다`,
      404,
    );
    return NextResponse.json(res.body, { status: res.status });
  }

  await completeTaskLog({
    logId: log.id,
    output,
    status,
    visualHtml: visual_html ?? null,
    contextSnapshot: context_snapshot ?? null,
    structuredOutput: structured_output,
    sessionId: session_id ?? null,
    providerSlug: resolvedProvider,
    userName: user_name ?? null,
    modelSlug: resolvedModel,
  });

  if (resolvedProvider) {
    await upsertAgentRegistrySlug({ kind: "provider", slug: resolvedProvider });
  }
  if (resolvedModel) {
    await upsertAgentRegistrySlug({ kind: "model", slug: resolvedModel });
  }

  if (context_snapshot) {
    await mergeTaskRunningContext({
      taskId,
      stepOrder: log.step_order,
      contextSnapshot: context_snapshot,
    });
  } else {
    await touchTaskUpdatedAt(taskId);
  }

  const artifactsSaved = Array.isArray(artifacts)
    ? await saveTaskArtifacts({
        taskId,
        stepOrder: log.step_order,
        artifacts,
      })
    : 0;

  const executedNode = await findExecutedNode(node_id);

  if (loop_continue && executedNode) {
    await enqueueLoopContinuation({
      taskId,
      nodeId: node_id,
      stepOrder: executedNode.step_order,
      title: executedNode.title,
      nodeType: executedNode.node_type,
    });
  }

  const requiresApproval = executedNode?.hitl ?? false;

  void notifyTaskUpdate(taskId, "step_executed", { node_id, status });
  const res = okResponse({
    success: true,
    task_id: taskId,
    node_id,
    status,
    loop_continue: !!loop_continue,
    artifacts_saved: artifactsSaved,
    ...(loop_continue &&
      executedNode?.loop_back_to != null && {
        next_action: "loop_back",
        loop_back_to: executedNode.loop_back_to,
      }),
    ...(!loop_continue &&
      requiresApproval && {
        next_action: "wait_for_human_approval",
        agent_instruction:
          "이 단계는 수동 승인이 필요합니다. request_approval 도구를 호출하여 승인 요청을 알린 후, 사람이 승인할 때까지 advance를 호출하지 마세요.",
      }),
  });
  return NextResponse.json(res.body, { status: res.status });
}
