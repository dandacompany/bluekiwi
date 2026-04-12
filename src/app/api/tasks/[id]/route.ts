import { NextRequest, NextResponse } from "next/server";
import {
  query,
  queryOne,
  execute,
  Task,
  TaskLog,
  Workflow,
  okResponse,
  errorResponse,
} from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import { canRead, canExecute, canEdit } from "@/lib/authorization";
import type { OwnedResource } from "@/lib/authorization";

type Params = { params: Promise<{ id: string }> };

/** Load a task and its parent workflow, returning both or an error response */
async function loadTaskWithWorkflow(id: string) {
  const task = await queryOne<Task>("SELECT * FROM tasks WHERE id = $1", [
    Number(id),
  ]);
  if (!task) return { error: "NOT_FOUND" as const, task: null, workflow: null };

  const workflow = await queryOne<Workflow>(
    "SELECT * FROM workflows WHERE id = $1",
    [task.workflow_id],
  );
  if (!workflow)
    return { error: "NOT_FOUND" as const, task: null, workflow: null };

  return { error: null, task, workflow };
}

export const GET = withAuth<Params>(
  "tasks:read",
  async (_request, user, { params }) => {
    const { id } = await params;
    const { error, task, workflow } = await loadTaskWithWorkflow(id);

    if (error || !task || !workflow) {
      const res = errorResponse("NOT_FOUND", "태스크를 찾을 수 없습니다", 404);
      return NextResponse.json(res.body, { status: res.status });
    }

    if (!(await canRead(user, workflow as OwnedResource))) {
      const res = errorResponse(
        "FORBIDDEN",
        "태스크 조회 권한이 없습니다",
        403,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    const logs = await query<TaskLog & { credential_service: string | null }>(
      `SELECT tl.*, (
       SELECT c.service_name FROM credentials c
       JOIN workflow_nodes cn2 ON cn2.credential_id = c.id
       WHERE cn2.id = tl.node_id
     ) as credential_service
     FROM task_logs tl WHERE tl.task_id = $1 ORDER BY tl.step_order ASC`,
      [task.id],
    );

    const wfInfo = await queryOne<{ title: string; node_count: number }>(
      `SELECT w.title, COUNT(wn.id)::int AS node_count
       FROM workflows w
       LEFT JOIN workflow_nodes wn ON wn.workflow_id = w.id
       WHERE w.id = $1
       GROUP BY w.id`,
      [task.workflow_id],
    );

    // Collect all slugs used in this task
    const slugs = new Set<string>();
    if (task.provider_slug) slugs.add(task.provider_slug);
    if (task.model_slug) slugs.add(task.model_slug);
    for (const log of logs) {
      if (log.provider_slug) slugs.add(log.provider_slug);
      if (log.model_slug) slugs.add(log.model_slug);
    }

    // Fetch display names from registry
    const registry: Record<string, string> = {};
    if (slugs.size > 0) {
      const slugArr = [...slugs];
      const placeholders = slugArr.map((_, i) => `$${i + 1}`).join(", ");
      const rows = await query<{ slug: string; display_name: string }>(
        `SELECT slug, display_name FROM agent_registry WHERE slug IN (${placeholders})`,
        slugArr,
      );
      for (const row of rows) {
        registry[row.slug] = row.display_name;
      }
    }

    const res = okResponse({
      ...task,
      workflow_title: wfInfo?.title ?? null,
      total_steps: wfInfo?.node_count ?? 0,
      logs,
      registry,
    });
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const PUT = withAuth<Params>(
  "tasks:execute",
  async (request: NextRequest, user, { params }) => {
    const { id } = await params;
    const { error, task, workflow } = await loadTaskWithWorkflow(id);

    if (error || !task || !workflow) {
      const res = errorResponse("NOT_FOUND", "태스크를 찾을 수 없습니다", 404);
      return NextResponse.json(res.body, { status: res.status });
    }

    if (!(await canExecute(user, workflow as OwnedResource))) {
      const res = errorResponse(
        "FORBIDDEN",
        "태스크 실행 권한이 없습니다",
        403,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    const body = await request.json();
    const { status } = body;

    await execute(
      "UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2",
      [status ?? task.status, Number(id)],
    );

    const updated = await queryOne<Task>("SELECT * FROM tasks WHERE id = $1", [
      Number(id),
    ]);
    const res = okResponse(updated);
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const DELETE = withAuth<Params>(
  "tasks:execute",
  async (_request, user, { params }) => {
    const { id } = await params;
    const { error, task, workflow } = await loadTaskWithWorkflow(id);

    if (error || !task || !workflow) {
      const res = errorResponse("NOT_FOUND", "태스크를 찾을 수 없습니다", 404);
      return NextResponse.json(res.body, { status: res.status });
    }

    if (!(await canEdit(user, workflow as OwnedResource))) {
      const res = errorResponse(
        "FORBIDDEN",
        "태스크 삭제 권한이 없습니다",
        403,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    await execute("DELETE FROM task_logs WHERE task_id = $1", [Number(id)]);
    await execute("DELETE FROM task_comments WHERE task_id = $1", [Number(id)]);
    await execute("DELETE FROM tasks WHERE id = $1", [Number(id)]);

    const res = okResponse({ deleted: true });
    return NextResponse.json(res.body, { status: res.status });
  },
);
