import { NextRequest, NextResponse } from "next/server";
import { query, queryOne, execute, okResponse, errorResponse } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
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
    agent_id,
    user_name,
    model_id,
  } = body;

  if (!node_id || !output || !status) {
    const res = errorResponse(
      "VALIDATION_ERROR",
      "node_id, output, status are required",
      400,
    );
    return NextResponse.json(res.body, { status: res.status });
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
         agent_id = COALESCE($7, agent_id),
         user_name = COALESCE($8, user_name),
         model_id = COALESCE($9, model_id)
     WHERE id = $10`,
    [
      output,
      status,
      visual_html ?? null,
      context_snapshot ?? null,
      structured_output ? JSON.stringify(structured_output) : null,
      session_id ?? null,
      agent_id ?? null,
      user_name ?? null,
      model_id ?? null,
      log.id,
    ],
  );

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

  // Loop continue
  if (loop_continue) {
    const node = await queryOne<{
      title: string;
      node_type: string;
      step_order: number;
    }>("SELECT title, node_type, step_order FROM chain_nodes WHERE id = $1", [
      node_id,
    ]);
    if (node) {
      await execute(
        "INSERT INTO task_logs (task_id, node_id, step_order, status, node_title, node_type) VALUES ($1, $2, $3, 'pending', $4, $5)",
        [taskId, node_id, node.step_order, node.title, node.node_type],
      );
    }
  }

  const res = okResponse({
    success: true,
    task_id: taskId,
    node_id,
    status,
    loop_continue: !!loop_continue,
    artifacts_saved: artifactsSaved,
  });
  return NextResponse.json(res.body, { status: res.status });
}
