import { NextRequest, NextResponse } from "next/server";
import {
  query,
  queryOne,
  insert,
  Task,
  TaskLog,
  Workflow,
  okResponse,
  listResponse,
  errorResponse,
} from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import { buildResourceVisibilityFilter, canExecute } from "@/lib/authorization";

export const GET = withAuth(
  "tasks:read",
  async (request: NextRequest, user) => {
    const { searchParams } = request.nextUrl;
    const workflowId = searchParams.get("workflow_id");
    const status = searchParams.get("status");

    const filter = await buildResourceVisibilityFilter("w", user, 1);

    let sql = `SELECT t.* FROM tasks t
      JOIN workflows w ON w.id = t.workflow_id
      WHERE ${filter.sql}`;
    const params: unknown[] = [...filter.params];

    if (workflowId) {
      params.push(Number(workflowId));
      sql += ` AND t.workflow_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      sql += ` AND t.status = $${params.length}`;
    }

    const q = searchParams.get("q");
    if (q) {
      params.push(`%${q}%`);
      sql += ` AND t.context LIKE $${params.length}`;
    }

    sql += " ORDER BY t.created_at DESC";

    const tasks = await query<Task>(sql, params);

    const tasksWithLogs = await Promise.all(
      tasks.map(async (task) => {
        const logs = await query<TaskLog>(
          "SELECT * FROM task_logs WHERE task_id = $1 ORDER BY step_order ASC",
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
        return {
          ...task,
          workflow_title: workflow?.title ?? null,
          total_steps: workflow?.node_count ?? 0,
          logs,
        };
      }),
    );

    const res = listResponse(tasksWithLogs, tasksWithLogs.length);
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const POST = withAuth("tasks:execute", async (request, user) => {
  const body = await request.json();
  const { workflow_id } = body;

  if (!workflow_id) {
    const res = errorResponse(
      "VALIDATION_ERROR",
      "workflow_id is required",
      400,
    );
    return NextResponse.json(res.body, { status: res.status });
  }

  const workflow = await queryOne<Workflow>(
    "SELECT * FROM workflows WHERE id = $1",
    [Number(workflow_id)],
  );
  if (!workflow) {
    const res = errorResponse("NOT_FOUND", "워크플로를 찾을 수 없습니다", 404);
    return NextResponse.json(res.body, { status: res.status });
  }

  if (!(await canExecute(user, workflow))) {
    const res = errorResponse(
      "FORBIDDEN",
      "워크플로 실행 권한이 없습니다",
      403,
    );
    return NextResponse.json(res.body, { status: res.status });
  }

  const taskId = await insert(
    "INSERT INTO tasks (workflow_id, status, current_step) VALUES ($1, 'running', 1) RETURNING id",
    [Number(workflow_id)],
  );

  const task = await queryOne<Task>("SELECT * FROM tasks WHERE id = $1", [
    taskId,
  ]);
  const res = okResponse(task, 201);
  return NextResponse.json(res.body, { status: res.status });
});
