import { NextRequest, NextResponse } from "next/server";
import { execute, queryOne, okResponse, errorResponse } from "@/lib/db";
import { requireAuth } from "@/lib/with-auth";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/tasks/:id/visual
 * body: { node_id: number, html: string }
 * 현재 pending/running 태스크 로그의 visual_html을 업데이트한다.
 * 에이전트가 set_visual_html 호출 시 사용 (output/status 변경 없음).
 */
export async function POST(request: NextRequest, { params }: Params) {
  const authResult = await requireAuth(request, "tasks:execute");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const taskId = Number(id);
  const body = await request.json();
  const { node_id, html } = body;

  if (!node_id || !html) {
    const res = errorResponse(
      "VALIDATION_ERROR",
      "node_id and html are required",
      400,
    );
    return NextResponse.json(res.body, { status: res.status });
  }

  const log = await queryOne<{ id: number }>(
    "SELECT id FROM task_logs WHERE task_id = $1 AND node_id = $2 AND status IN ('pending', 'running') ORDER BY id DESC LIMIT 1",
    [taskId, Number(node_id)],
  );
  if (!log) {
    const res = errorResponse(
      "NOT_FOUND",
      "실행 중인 로그를 찾을 수 없습니다",
      404,
    );
    return NextResponse.json(res.body, { status: res.status });
  }

  await execute("UPDATE task_logs SET visual_html = $1 WHERE id = $2", [
    html,
    log.id,
  ]);

  const res = okResponse({
    task_id: taskId,
    node_id: Number(node_id),
    visual_html_set: true,
  });
  return NextResponse.json(res.body, { status: res.status });
}
