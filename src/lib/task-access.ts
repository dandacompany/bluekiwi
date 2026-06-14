import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/db";
import { loadTaskWithWorkflow } from "@/lib/db/repositories/tasks";
import { canRead, canExecute } from "@/lib/authorization";
import type { OwnedResource } from "@/lib/authorization";
import type { User } from "@/lib/auth";

type LoadedTask = Awaited<ReturnType<typeof loadTaskWithWorkflow>>;

export type TaskAccess = {
  task: NonNullable<LoadedTask["task"]>;
  workflow: NonNullable<LoadedTask["workflow"]>;
};

/**
 * Object-level authorization guard for `tasks/:id/*` routes (C-3 IDOR/BOLA).
 *
 * Loads the task + owning workflow, returns a 404 NextResponse if missing,
 * a 403 NextResponse if the user may not access it, otherwise the loaded
 * `{ task, workflow }`. Callers must check `instanceof NextResponse`.
 */
export async function requireTaskAccess(
  id: number,
  user: User,
  mode: "read" | "execute",
): Promise<TaskAccess | NextResponse> {
  const { task, workflow } = await loadTaskWithWorkflow(id);

  if (!task || !workflow) {
    const res = errorResponse("NOT_FOUND", "태스크를 찾을 수 없습니다", 404);
    return NextResponse.json(res.body, { status: res.status });
  }

  const allowed =
    mode === "read"
      ? await canRead(user, workflow as OwnedResource)
      : await canExecute(user, workflow as OwnedResource);

  if (!allowed) {
    const message =
      mode === "read"
        ? "태스크 조회 권한이 없습니다"
        : "태스크 실행 권한이 없습니다";
    const res = errorResponse("FORBIDDEN", message, 403);
    return NextResponse.json(res.body, { status: res.status });
  }

  return { task, workflow };
}
