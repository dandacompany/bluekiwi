import { NextRequest, NextResponse } from "next/server";
import { queryOne, execute, okResponse, errorResponse } from "@/lib/db";
import { notifyTaskUpdate } from "@/lib/notify-ws";
import { requireAuth } from "@/lib/with-auth";

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
    const taskRow = await queryOne<{ provider_slug: string | null }>(
      "SELECT provider_slug FROM tasks WHERE id = $1",
      [taskId],
    );
    resolvedProvider = taskRow?.provider_slug ?? null;
  }

  // Find pending/running log
  const log = await queryOne<{ id: number; step_order: number }>(
    "SELECT id, step_order FROM task_logs WHERE task_id = $1 AND node_id = $2 AND status IN ('running', 'pending') ORDER BY id DESC LIMIT 1",
    [taskId, node_id],
  );
  if (!log) {
    const res = errorResponse(
      "NOT_FOUND",
      `task_id=${taskId}, node_id=${node_id}에 대한 실행 중인 로그를 찾을 수 없습니다`,
      404,
    );
    return NextResponse.json(res.body, { status: res.status });
  }

  // Update log
  await execute(
    `UPDATE task_logs
     SET output = $1, status = $2, completed_at = NOW(),
         visual_html = COALESCE($3, visual_html),
         context_snapshot = COALESCE($4, context_snapshot),
         structured_output = COALESCE($5::jsonb, structured_output),
         session_id = COALESCE($6, session_id),
         provider_slug = COALESCE($7, provider_slug),
         user_name = COALESCE($8, user_name),
         model_slug = COALESCE($9, model_slug)
     WHERE id = $10`,
    [
      output,
      status,
      visual_html ?? null,
      context_snapshot ?? null,
      structured_output ? JSON.stringify(structured_output) : null,
      session_id ?? null,
      resolvedProvider,
      user_name ?? null,
      resolvedModel,
      log.id,
    ],
  );

  if (resolvedProvider) {
    await execute(
      "INSERT INTO agent_registry (kind, slug, display_name) VALUES ('provider', $1, $1) ON CONFLICT (kind, slug) DO NOTHING",
      [resolvedProvider],
    );
  }
  if (resolvedModel) {
    await execute(
      "INSERT INTO agent_registry (kind, slug, display_name) VALUES ('model', $1, $1) ON CONFLICT (kind, slug) DO NOTHING",
      [resolvedModel],
    );
  }

  // Merge context_snapshot into running_context
  if (context_snapshot) {
    const task = await queryOne<{ running_context: string }>(
      "SELECT running_context FROM tasks WHERE id = $1",
      [taskId],
    );
    const existing = task ? JSON.parse(task.running_context || "{}") : {};
    const snapshot =
      typeof context_snapshot === "string"
        ? JSON.parse(context_snapshot)
        : context_snapshot;
    const merged = {
      ...existing,
      ...snapshot,
      last_completed_step: log.step_order,
      last_updated: new Date().toISOString(),
    };
    await execute(
      "UPDATE tasks SET running_context = $1, updated_at = NOW() WHERE id = $2",
      [JSON.stringify(merged), taskId],
    );
  } else {
    await execute("UPDATE tasks SET updated_at = NOW() WHERE id = $1", [
      taskId,
    ]);
  }

  // Save artifacts
  let artifactsSaved = 0;
  if (Array.isArray(artifacts)) {
    for (const art of artifacts) {
      await execute(
        "INSERT INTO task_artifacts (task_id, step_order, artifact_type, title, file_path, git_ref, git_branch, url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [
          taskId,
          log.step_order,
          art.artifact_type ?? "file",
          art.title ?? "",
          art.file_path ?? null,
          art.git_ref ?? null,
          art.git_branch ?? null,
          art.url ?? null,
        ],
      );
      artifactsSaved++;
    }
  }

  const executedNode = await queryOne<{
    title: string;
    node_type: string;
    step_order: number;
    loop_back_to: number | null;
    hitl: boolean;
  }>(
    "SELECT title, node_type, step_order, loop_back_to, hitl FROM workflow_nodes WHERE id = $1",
    [node_id],
  );

  // Loop continue
  if (loop_continue && executedNode) {
    await execute(
      "INSERT INTO task_logs (task_id, node_id, step_order, status, node_title, node_type) VALUES ($1, $2, $3, 'pending', $4, $5)",
      [
        taskId,
        node_id,
        executedNode.step_order,
        executedNode.title,
        executedNode.node_type,
      ],
    );
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
