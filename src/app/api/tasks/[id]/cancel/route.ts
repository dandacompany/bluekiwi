import { NextRequest, NextResponse } from "next/server";
import { okResponse, errorResponse } from "@/lib/db";
import { requireAuth } from "@/lib/with-auth";
import { cancelTask, loadTaskWithWorkflow } from "@/lib/db/repositories/tasks";
import { canExecute } from "@/lib/authorization";
import type { OwnedResource } from "@/lib/authorization";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const authResult = await requireAuth(request, "tasks:execute");
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  const { id } = await params;
  const taskId = Number(id);

  const { task, workflow } = await loadTaskWithWorkflow(taskId);
  if (!task || !workflow) {
    const res = errorResponse("NOT_FOUND", "태스크를 찾을 수 없습니다", 404);
    return NextResponse.json(res.body, { status: res.status });
  }

  if (!(await canExecute(user, workflow as OwnedResource))) {
    const res = errorResponse("FORBIDDEN", "태스크 실행 권한이 없습니다", 403);
    return NextResponse.json(res.body, { status: res.status });
  }

  if (task.status !== "running") {
    const res = errorResponse(
      "PRECONDITION_FAILED",
      `실행 중인 태스크만 중지할 수 있습니다 (현재 상태: ${task.status})`,
      412,
    );
    return NextResponse.json(res.body, { status: res.status });
  }

  const updated = await cancelTask(taskId);
  const res = okResponse(updated);
  return NextResponse.json(res.body, { status: res.status });
}
