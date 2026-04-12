import { NextRequest, NextResponse } from "next/server";
import {
  query,
  queryOne,
  execute,
  Task,
  TaskLog,
  okResponse,
  errorResponse,
} from "@/lib/db";
import { withOptionalAuth } from "@/lib/with-auth";

type Params = { params: Promise<{ id: string }> };

export const GET = withOptionalAuth<Params>(
  "tasks:read",
  async (_request, _user, { params }: Params) => {
    const { id } = await params;

    const task = await queryOne<Task>("SELECT * FROM tasks WHERE id = $1", [
      Number(id),
    ]);
    if (!task) {
      const res = errorResponse("NOT_FOUND", "태스크를 찾을 수 없습니다", 404);
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

    const workflow = await queryOne<{ title: string; node_count: number }>(
      `SELECT w.title, COUNT(wn.id)::int AS node_count
       FROM workflows w
       LEFT JOIN workflow_nodes wn ON wn.workflow_id = w.id
       WHERE w.id = $1
       GROUP BY w.id`,
      [task.workflow_id],
    );

    const res = okResponse({
      ...task,
      workflow_title: workflow?.title ?? null,
      total_steps: workflow?.node_count ?? 0,
      logs,
    });
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const PUT = withOptionalAuth<Params>(
  "tasks:execute",
  async (request: NextRequest, _user, { params }: Params) => {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    const existing = await queryOne<Task>("SELECT * FROM tasks WHERE id = $1", [
      Number(id),
    ]);
    if (!existing) {
      const res = errorResponse("NOT_FOUND", "태스크를 찾을 수 없습니다", 404);
      return NextResponse.json(res.body, { status: res.status });
    }

    await execute(
      "UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2",
      [status ?? existing.status, Number(id)],
    );

    const updated = await queryOne<Task>("SELECT * FROM tasks WHERE id = $1", [
      Number(id),
    ]);
    const res = okResponse(updated);
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const DELETE = withOptionalAuth<Params>(
  "tasks:execute",
  async (_request, _user, { params }: Params) => {
    const { id } = await params;

    const existing = await queryOne<Task>("SELECT * FROM tasks WHERE id = $1", [
      Number(id),
    ]);
    if (!existing) {
      const res = errorResponse("NOT_FOUND", "태스크를 찾을 수 없습니다", 404);
      return NextResponse.json(res.body, { status: res.status });
    }

    await execute("DELETE FROM task_logs WHERE task_id = $1", [Number(id)]);
    await execute("DELETE FROM task_comments WHERE task_id = $1", [Number(id)]);
    await execute("DELETE FROM tasks WHERE id = $1", [Number(id)]);

    const res = okResponse({ deleted: true });
    return NextResponse.json(res.body, { status: res.status });
  },
);
