import { NextRequest, NextResponse } from "next/server";
import { query, execute, okResponse, errorResponse } from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import { notifyTaskUpdate } from "@/lib/notify-ws";

/**
 * POST /api/tasks/timeout-stale
 *
 * 비활성 태스크 자동 종료 엔드포인트.
 * `running` 상태이면서 `updated_at`이 timeout_minutes(기본 120분) 이상
 * 경과한 태스크를 `timed_out`으로 전환한다.
 *
 * bk-start 스킬이 워크플로 실행 전 이 엔드포인트를 호출하여
 * 좀비 태스크를 정리하고, 재개 여부를 사용자에게 물을 수 있다.
 */
export const POST = withAuth(
  "tasks:execute",
  async (request: NextRequest, _user) => {
    const body = await request.json().catch(() => ({}));
    const timeoutMinutes = Number(body.timeout_minutes ?? 120);

    if (isNaN(timeoutMinutes) || timeoutMinutes < 1) {
      const res = errorResponse(
        "VALIDATION_ERROR",
        "timeout_minutes must be a positive number",
        400,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    // updated_at 기준으로 비활성 running 태스크 조회
    const staleTasks = await query<{ id: number }>(
      `SELECT id FROM tasks
       WHERE status = 'running'
         AND updated_at < NOW() - ($1 || ' minutes')::INTERVAL`,
      [timeoutMinutes],
    );

    if (staleTasks.length === 0) {
      const res = okResponse({ timed_out_count: 0, task_ids: [] });
      return NextResponse.json(res.body, { status: res.status });
    }

    const ids = staleTasks.map((t) => t.id);

    // timed_out으로 일괄 전환
    await execute(
      `UPDATE tasks SET status = 'timed_out', updated_at = NOW()
       WHERE id = ANY($1::int[])`,
      [ids],
    );

    // 각 태스크에 WS 알림 발송
    for (const id of ids) {
      void notifyTaskUpdate(id, "task_timed_out");
    }

    const res = okResponse({ timed_out_count: ids.length, task_ids: ids });
    return NextResponse.json(res.body, { status: res.status });
  },
);

/**
 * GET /api/tasks/timeout-stale
 *
 * 현재 비활성(running) 태스크 목록을 반환한다. (dry-run 조회)
 * bk-start 스킬이 사용자에게 재개 여부를 묻기 전 조회에 사용.
 */
export const GET = withAuth(
  "tasks:read",
  async (request: NextRequest, _user) => {
    const { searchParams } = request.nextUrl;
    const timeoutMinutes = Number(searchParams.get("timeout_minutes") ?? 120);

    const staleTasks = await query<{
      id: number;
      workflow_id: number;
      current_step: number;
      status: string;
      updated_at: string;
    }>(
      `SELECT t.id, t.workflow_id, t.current_step, t.status, t.updated_at
       FROM tasks t
       WHERE t.status IN ('running', 'timed_out')
         AND t.updated_at < NOW() - ($1 || ' minutes')::INTERVAL
       ORDER BY t.updated_at DESC`,
      [timeoutMinutes],
    );

    const res = okResponse(staleTasks);
    return NextResponse.json(res.body, { status: res.status });
  },
);
