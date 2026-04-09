import { NextRequest, NextResponse } from "next/server";
import {
  query,
  queryOne,
  insert,
  Task,
  TaskLog,
  Chain,
  okResponse,
  listResponse,
  errorResponse,
} from "@/lib/db";
import { withOptionalAuth } from "@/lib/with-auth";

export const GET = withOptionalAuth(
  "tasks:read",
  async (request: NextRequest) => {
    const { searchParams } = request.nextUrl;
    const chainId = searchParams.get("chain_id");
    const status = searchParams.get("status");

    let sql = "SELECT * FROM tasks WHERE 1=1";
    const params: unknown[] = [];
    let paramIdx = 0;

    if (chainId) {
      paramIdx++;
      sql += ` AND chain_id = $${paramIdx}`;
      params.push(Number(chainId));
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
        const chain = await queryOne<{ title: string }>(
          "SELECT title FROM chains WHERE id = $1",
          [task.chain_id],
        );
        return { ...task, chain_title: chain?.title ?? null, logs };
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
    const { chain_id } = body;

    if (!chain_id) {
      const res = errorResponse(
        "VALIDATION_ERROR",
        "chain_id is required",
        400,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    const chain = await queryOne<Chain>("SELECT * FROM chains WHERE id = $1", [
      Number(chain_id),
    ]);
    if (!chain) {
      const res = errorResponse("NOT_FOUND", "체인을 찾을 수 없습니다", 404);
      return NextResponse.json(res.body, { status: res.status });
    }

    const taskId = await insert(
      "INSERT INTO tasks (chain_id, status, current_step) VALUES ($1, 'running', 1) RETURNING id",
      [Number(chain_id)],
    );

    const task = await queryOne<Task>("SELECT * FROM tasks WHERE id = $1", [
      taskId,
    ]);
    const res = okResponse(task, 201);
    return NextResponse.json(res.body, { status: res.status });
  },
);
