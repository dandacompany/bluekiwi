import { NextRequest, NextResponse } from "next/server";
import { query, execute, okResponse, errorResponse } from "@/lib/db";
import { requireAuth } from "@/lib/with-auth";

type Params = { params: Promise<{ id: string }> };

// MCP get_web_response — 에이전트가 사용자의 web_response를 폴링
export async function GET(request: NextRequest, { params }: Params) {
  const authResult = await requireAuth(request, "tasks:read");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const rows = await query<{
    node_id: number;
    step_order: number;
    web_response: string | null;
  }>(
    "SELECT node_id, step_order, web_response FROM task_logs WHERE task_id = $1 AND web_response IS NOT NULL ORDER BY step_order DESC LIMIT 1",
    [Number(id)],
  );

  if (rows.length === 0) {
    const res = okResponse({ task_id: Number(id), web_response: null });
    return NextResponse.json(res.body, { status: res.status });
  }

  const row = rows[0];
  let parsed: unknown = row.web_response;
  try {
    parsed = JSON.parse(row.web_response!);
  } catch {}

  const res = okResponse({
    task_id: Number(id),
    node_id: row.node_id,
    step_order: row.step_order,
    web_response: parsed,
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

  if (!node_id || !response) {
    const res = errorResponse(
      "VALIDATION_ERROR",
      "node_id and response are required",
      400,
    );
    return NextResponse.json(res.body, { status: res.status });
  }

  // 해당 태스크의 해당 노드 로그에 web_response 저장
  const result = await execute(
    "UPDATE task_logs SET web_response = $1 WHERE task_id = $2 AND node_id = $3 AND status IN ('pending', 'running')",
    [JSON.stringify(response), Number(id), Number(node_id)],
  );

  if (result.rowCount === 0) {
    const res = errorResponse("NOT_FOUND", "해당 로그를 찾을 수 없습니다", 404);
    return NextResponse.json(res.body, { status: res.status });
  }

  await execute("UPDATE tasks SET updated_at = NOW() WHERE id = $1", [
    Number(id),
  ]);

  const res = okResponse({
    task_id: Number(id),
    node_id: Number(node_id),
    responded: true,
  });
  return NextResponse.json(res.body, { status: res.status });
}
