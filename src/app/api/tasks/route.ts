import { NextRequest, NextResponse } from "next/server";
import { Workflow, okResponse, listResponse, errorResponse } from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import { buildResourceVisibilityFilter, canExecute } from "@/lib/authorization";
import { createTaskForWorkflow, findWorkflowByIdForTask, listTasksForVisibilityFilter } from "@/lib/db/repositories/tasks";

export const GET = withAuth(
  "tasks:read",
  async (request: NextRequest, user) => {
    const { searchParams } = request.nextUrl;
    const workflowId = searchParams.get("workflow_id");
    const status = searchParams.get("status");

    const filter = await buildResourceVisibilityFilter("w", user, 1);

    const q = searchParams.get("q");
    const tasks = await listTasksForVisibilityFilter({
      filterSql: filter.sql,
      filterParams: filter.params,
      workflowId: workflowId ? Number(workflowId) : undefined,
      status: status ?? undefined,
      q: q ?? undefined,
    });

    const res = listResponse(tasks, tasks.length);
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

  const workflow = await findWorkflowByIdForTask(Number(workflow_id));
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

  const task = await createTaskForWorkflow(Number(workflow_id));
  const res = okResponse(task, 201);
  return NextResponse.json(res.body, { status: res.status });
});
