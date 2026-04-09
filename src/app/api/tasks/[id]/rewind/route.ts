import { NextRequest, NextResponse } from "next/server";
import {
  query,
  queryOne,
  execute,
  Task,
  ChainNode,
  maskSecrets,
  okResponse,
  errorResponse,
} from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const taskId = Number(id);
  const body = await request.json();
  const { to_step } = body;

  if (!to_step || typeof to_step !== "number") {
    const res = errorResponse("VALIDATION_ERROR", "to_step is required", 400);
    return NextResponse.json(res.body, { status: res.status });
  }

  const task = await queryOne<Task>("SELECT * FROM tasks WHERE id = $1", [
    taskId,
  ]);
  if (!task) {
    const res = errorResponse("NOT_FOUND", "태스크를 찾을 수 없습니다", 404);
    return NextResponse.json(res.body, { status: res.status });
  }

  const targetNode = await queryOne<ChainNode>(
    "SELECT * FROM chain_nodes WHERE chain_id = $1 AND step_order = $2",
    [task.chain_id, to_step],
  );
  if (!targetNode) {
    const res = errorResponse(
      "NOT_FOUND",
      `스텝 ${to_step}을 찾을 수 없습니다`,
      404,
    );
    return NextResponse.json(res.body, { status: res.status });
  }

  // Cancel current pending/running logs
  await execute(
    "UPDATE task_logs SET status = 'cancelled', completed_at = NOW() WHERE task_id = $1 AND status IN ('pending', 'running')",
    [taskId],
  );

  // Set current_step
  await execute(
    "UPDATE tasks SET current_step = $1, updated_at = NOW() WHERE id = $2",
    [to_step, taskId],
  );

  // Create new pending log
  await execute(
    "INSERT INTO task_logs (task_id, node_id, step_order, status, node_title, node_type) VALUES ($1, $2, $3, 'pending', $4, $5)",
    [taskId, targetNode.id, to_step, targetNode.title, targetNode.node_type],
  );

  // Resolve instruction
  let instruction = targetNode.instruction;
  if (targetNode.instruction_id) {
    const inst = await queryOne<{ content: string }>(
      "SELECT content FROM instructions WHERE id = $1",
      [targetNode.instruction_id],
    );
    if (inst) instruction = inst.content;
  }

  // Resolve credential (masked)
  let credentials = null;
  if (targetNode.credential_id) {
    const cred = await queryOne<{
      service_name: string;
      title: string;
      secrets: string;
    }>("SELECT service_name, title, secrets FROM credentials WHERE id = $1", [
      targetNode.credential_id,
    ]);
    if (cred) {
      credentials = {
        service: cred.service_name,
        title: cred.title,
        secrets_masked: maskSecrets(cred.secrets),
      };
    }
  }

  const comments = await query(
    "SELECT * FROM task_comments WHERE task_id = $1 AND step_order = $2 ORDER BY created_at DESC",
    [taskId, to_step],
  );

  const totalRows = await queryOne<{ count: string }>(
    "SELECT COUNT(*) as count FROM chain_nodes WHERE chain_id = $1",
    [task.chain_id],
  );

  const res = okResponse({
    task_id: taskId,
    rewound_to: to_step,
    total_steps: Number(totalRows?.count ?? 0),
    current_step: {
      node_id: targetNode.id,
      step_order: targetNode.step_order,
      node_type: targetNode.node_type,
      title: targetNode.title,
      instruction,
      auto_advance: !!targetNode.auto_advance,
      loop_back_to: targetNode.loop_back_to,
      credentials,
    },
    comments: comments.length > 0 ? comments : null,
  });
  return NextResponse.json(res.body, { status: res.status });
}
