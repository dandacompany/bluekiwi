import { NextRequest, NextResponse } from "next/server";
import { queryOne, execute, okResponse, errorResponse } from "@/lib/db";
import { requireAuth } from "@/lib/with-auth";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const authResult = await requireAuth(request, "tasks:execute");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const taskId = Number(id);
  const body = await request.json();
  const { node_id, progress } = body;

  if (!node_id || !progress) {
    const res = errorResponse(
      "VALIDATION_ERROR",
      "node_id and progress are required",
      400,
    );
    return NextResponse.json(res.body, { status: res.status });
  }

  const log = await queryOne<{ id: number; output: string }>(
    "SELECT id, output FROM task_logs WHERE task_id = $1 AND node_id = $2 AND status IN ('running', 'pending') ORDER BY id DESC LIMIT 1",
    [taskId, node_id],
  );

  if (log) {
    const updated = log.output ? `${log.output}\n${progress}` : progress;
    await execute("UPDATE task_logs SET output = $1 WHERE id = $2", [
      updated,
      log.id,
    ]);
  }

  await execute("UPDATE tasks SET updated_at = $2 WHERE id = $1", [
    taskId,
    new Date().toISOString(),
  ]);

  const res = okResponse({ success: true, task_id: taskId, node_id });
  return NextResponse.json(res.body, { status: res.status });
}
