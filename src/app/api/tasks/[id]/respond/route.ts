import { NextRequest, NextResponse } from "next/server";
import { execute, okResponse, errorResponse } from "@/lib/db";
import { requireAuth } from "@/lib/with-auth";

type Params = { params: Promise<{ id: string }> };

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
