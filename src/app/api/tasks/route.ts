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
import { withOptionalAuth } from "@/lib/with-auth";

export const GET = withOptionalAuth(
  "tasks:read",
  async (request: NextRequest) => {
    const { searchParams } = request.nextUrl;
    const workflowId = searchParams.get("workflow_id");
    const status = searchParams.get("status");

    let sql = "SELECT * FROM tasks WHERE 1=1";
    const params: unknown[] = [];
    let paramIdx = 0;

    if (workflowId) {
      paramIdx++;
      sql += ` AND workflow_id = $${paramIdx}`;
      params.push(Number(workflowId));
    }
    if (status) {
      paramIdx++;
      sql += ` AND status = $${paramIdx}`;
      params.push(status);
    }

    const q = searchParams.get("q");
    if (q) {
      paramIdx++;
      sql += ` AND context LIKE $${paramIdx}`;
      params.push(`%${q}%`);
    }

    sql += " ORDER BY created_at DESC";

    const tasks = await query<Task>(sql, params);

    const tasksWithLogs = await Promise.all(
      tasks.map(async (task) => {
        const logs = await query<TaskLog>(
          "SELECT * FROM task_logs WHERE task_id = $1 ORDER BY step_order ASC",
          [task.id],
        );
        const workflow = await queryOne<{ title: string }>(
          "SELECT title FROM workflows WHERE id = $1",
          [task.workflow_id],
        );
        return { ...task, workflow_title: workflow?.title ?? null, logs };
      }),
    );

    const res = listResponse(tasksWithLogs, tasksWithLogs.length);
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const POST = withOptionalAuth(
  "tasks:create",
  async (request: NextRequest) => {
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
      const res = errorResponse(
        "NOT_FOUND",
        "워크플로를 찾을 수 없습니다",
        404,
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
  },
);
