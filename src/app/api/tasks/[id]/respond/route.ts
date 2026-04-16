import { NextRequest, NextResponse } from "next/server";
import { query, execute, okResponse, errorResponse } from "@/lib/db";
import { requireAuth } from "@/lib/with-auth";

type Params = { params: Promise<{ id: string }> };

function parseStoredWebResponse(value: string | null): unknown {
  if (!value) return null;
  let parsed: unknown = value;
  try {
    parsed = JSON.parse(value);
  } catch {
    return value;
  }
  if (typeof parsed === "string") {
    try {
      return JSON.parse(parsed);
    } catch {
      return parsed;
    }
  }
  return parsed;
}

function normalizeIncomingResponse(response: unknown): unknown {
  if (typeof response !== "string") return response;
  try {
    return JSON.parse(response);
  } catch {
    return response;
  }
}

// MCP get_web_response — 에이전트가 사용자의 web_response를 폴링
export async function GET(request: NextRequest, { params }: Params) {
  const authResult = await requireAuth(request, "tasks:read");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const taskId = Number(id);
  const nodeIdParam = request.nextUrl.searchParams.get("node_id");

  if (nodeIdParam) {
    const nodeId = Number(nodeIdParam);
    const rows = await query<{
      iteration: number;
      web_response: string | null;
      created_at: string;
    }>(
      `SELECT
         ROW_NUMBER() OVER (PARTITION BY task_id, node_id ORDER BY id) AS iteration,
         web_response,
         created_at
       FROM task_logs
       WHERE task_id = $1 AND node_id = $2 AND web_response IS NOT NULL
       ORDER BY id ASC`,
      [taskId, nodeId],
    );

    const history = rows.map((row) => {
      return {
        iteration: row.iteration,
        web_response: parseStoredWebResponse(row.web_response),
        created_at: row.created_at,
      };
    });

    const res = okResponse({ task_id: taskId, node_id: nodeId, history });
    return NextResponse.json(res.body, { status: res.status });
  }

  const rows = await query<{
    node_id: number;
    step_order: number;
    web_response: string | null;
  }>(
    "SELECT node_id, step_order, web_response FROM task_logs WHERE task_id = $1 AND web_response IS NOT NULL ORDER BY step_order DESC LIMIT 1",
    [taskId],
  );

  if (rows.length === 0) {
    const res = okResponse({ task_id: taskId, web_response: null });
    return NextResponse.json(res.body, { status: res.status });
  }

  const row = rows[0];
  const res = okResponse({
    task_id: taskId,
    node_id: row.node_id,
    step_order: row.step_order,
    web_response: parseStoredWebResponse(row.web_response),
  });
  return NextResponse.json(res.body, { status: res.status });
}

// 웹 UI에서 사용자가 gate 노드에 응답할 때 호출
export async function POST(request: NextRequest, { params }: Params) {
  const authResult = await requireAuth(request, "tasks:execute");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const body = await request.json();
  const { node_id, response } = body;

  if (!node_id || response === undefined || response === null) {
    const res = errorResponse(
      "VALIDATION_ERROR",
      "node_id and response are required",
      400,
    );
    return NextResponse.json(res.body, { status: res.status });
  }

  // 해당 태스크의 해당 노드 로그에 web_response 저장
  // visual_selection 스텝은 completed 상태에서도 응답 가능 (에이전트가 먼저 completed로 표시한 경우)
  const result = await execute(
    "UPDATE task_logs SET web_response = $1 WHERE task_id = $2 AND node_id = $3 AND status IN ('pending', 'running', 'completed')",
    [
      JSON.stringify(normalizeIncomingResponse(response)),
      Number(id),
      Number(node_id),
    ],
  );

  if (result.rowCount === 0) {
    const res = errorResponse("NOT_FOUND", "해당 로그를 찾을 수 없습니다", 404);
    return NextResponse.json(res.body, { status: res.status });
  }

  await execute("UPDATE tasks SET updated_at = $2 WHERE id = $1", [
    Number(id),
    new Date().toISOString(),
  ]);

  const res = okResponse({
    task_id: Number(id),
    node_id: Number(node_id),
    responded: true,
  });
  return NextResponse.json(res.body, { status: res.status });
}
