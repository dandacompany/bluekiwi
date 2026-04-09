import { NextRequest, NextResponse } from "next/server";
import {
  query,
  queryOne,
  insert,
  Chain,
  ChainNode,
  maskSecrets,
  okResponse,
  errorResponse,
} from "@/lib/db";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { chain_id, version, context, session_meta } = body;

  if (!chain_id) {
    const res = errorResponse("VALIDATION_ERROR", "chain_id is required", 400);
    return NextResponse.json(res.body, { status: res.status });
  }

  // Resolve chain (optionally by version)
  let chain: Chain | undefined;
  if (version) {
    const requested = await queryOne<Chain>(
      "SELECT * FROM chains WHERE id = $1",
      [Number(chain_id)],
    );
    if (!requested) {
      const res = errorResponse("NOT_FOUND", "체인을 찾을 수 없습니다", 404);
      return NextResponse.json(res.body, { status: res.status });
    }
    chain = await queryOne<Chain>(
      "SELECT * FROM chains WHERE title = $1 AND version = $2",
      [requested.title, version],
    );
    if (!chain) {
      const res = errorResponse(
        "NOT_FOUND",
        `버전 ${version}에 해당하는 체인을 찾을 수 없습니다`,
        404,
      );
      return NextResponse.json(res.body, { status: res.status });
    }
  } else {
    chain = await queryOne<Chain>("SELECT * FROM chains WHERE id = $1", [
      Number(chain_id),
    ]);
    if (!chain) {
      const res = errorResponse("NOT_FOUND", "체인을 찾을 수 없습니다", 404);
      return NextResponse.json(res.body, { status: res.status });
    }
  }

  const firstNode = await queryOne<ChainNode>(
    "SELECT * FROM chain_nodes WHERE chain_id = $1 ORDER BY step_order ASC LIMIT 1",
    [chain.id],
  );
  if (!firstNode) {
    const res = errorResponse(
      "VALIDATION_ERROR",
      "체인에 노드가 없습니다",
      400,
    );
    return NextResponse.json(res.body, { status: res.status });
  }

  const totalRows = await queryOne<{ count: string }>(
    "SELECT COUNT(*) as count FROM chain_nodes WHERE chain_id = $1",
    [chain.id],
  );
  const totalSteps = Number(totalRows?.count ?? 0);

  // Create task
  const taskId = await insert(
    "INSERT INTO tasks (chain_id, status, current_step, context, session_meta) VALUES ($1, 'running', 1, $2, $3) RETURNING id",
    [chain.id, context ?? "", session_meta ?? "{}"],
  );

  // Create first pending log
  await query(
    "INSERT INTO task_logs (task_id, node_id, step_order, status, node_title, node_type) VALUES ($1, $2, $3, 'pending', $4, $5)",
    [
      taskId,
      firstNode.id,
      firstNode.step_order,
      firstNode.title,
      firstNode.node_type,
    ],
  );

  // Resolve instruction
  let instruction = firstNode.instruction;
  if (firstNode.instruction_id) {
    const inst = await queryOne<{ content: string }>(
      "SELECT content FROM instructions WHERE id = $1",
      [firstNode.instruction_id],
    );
    if (inst) instruction = inst.content;
  }

  // Resolve credential (masked)
  let credentials = null;
  if (firstNode.credential_id) {
    const cred = await queryOne<{
      service_name: string;
      title: string;
      secrets: string;
    }>("SELECT service_name, title, secrets FROM credentials WHERE id = $1", [
      firstNode.credential_id,
    ]);
    if (cred) {
      credentials = {
        service: cred.service_name,
        title: cred.title,
        secrets_masked: maskSecrets(cred.secrets),
      };
    }
  }

  const res = okResponse(
    {
      task_id: taskId,
      chain_id: chain.id,
      chain_title: chain.title,
      version: chain.version,
      evaluation_contract: chain.evaluation_contract ?? null,
      total_steps: totalSteps,
      current_step: {
        node_id: firstNode.id,
        step_order: firstNode.step_order,
        node_type: firstNode.node_type,
        title: firstNode.title,
        instruction,
        auto_advance: !!firstNode.auto_advance,
        loop_back_to: firstNode.loop_back_to,
        credentials,
      },
    },
    201,
  );
  return NextResponse.json(res.body, { status: res.status });
}
