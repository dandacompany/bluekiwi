import { NextRequest, NextResponse } from "next/server";
import { okResponse, errorResponse } from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import { canRead, canExecute, canEdit } from "@/lib/authorization";
import type { OwnedResource } from "@/lib/authorization";
import {
  deleteTaskCascade,
  getTaskRegistryMap,
  getWorkflowTaskInfo,
  listTaskLogsWithCredentialService,
  loadTaskWithWorkflow,
  updateTaskStatus,
} from "@/lib/db/repositories/tasks";

type Params = { params: Promise<{ id: string }> };

export const GET = withAuth<Params>(
  "tasks:read",
  async (_request, user, { params }) => {
    const { id } = await params;
    const { task, workflow } = await loadTaskWithWorkflow(Number(id));

    if (!task || !workflow) {
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

    const logs = await listTaskLogsWithCredentialService(task.id);
    const wfInfo = await getWorkflowTaskInfo(task.workflow_id);
    const registry = await getTaskRegistryMap(task, logs);

    const res = okResponse({
      ...task,
      workflow_title: wfInfo.title,
      total_steps: wfInfo.node_count,
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
    const { task, workflow } = await loadTaskWithWorkflow(Number(id));

    if (!task || !workflow) {
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

    const updated = await updateTaskStatus(Number(id), status ?? task.status);
    const res = okResponse(updated);
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const DELETE = withAuth<Params>(
  "tasks:execute",
  async (_request, user, { params }) => {
    const { id } = await params;
    const { task, workflow } = await loadTaskWithWorkflow(Number(id));

    if (!task || !workflow) {
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

    await deleteTaskCascade(Number(id));

    const res = okResponse({ deleted: true });
    return NextResponse.json(res.body, { status: res.status });
  },
);
