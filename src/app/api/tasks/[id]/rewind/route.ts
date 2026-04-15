import { NextRequest, NextResponse } from "next/server";
import { okResponse, errorResponse } from "@/lib/db";
import { requireAuth } from "@/lib/with-auth";
import {
  findTaskById,
  findWorkflowNodeByStep,
  getWorkflowTaskInfo,
  listTaskComments,
  resolveTaskNodeResponse,
  rewindTaskToStep,
} from "@/lib/db/repositories/tasks";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const authResult = await requireAuth(request, "tasks:execute");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const taskId = Number(id);
  const body = await request.json();
  const { to_step } = body;

  if (!to_step || typeof to_step !== "number") {
    const res = errorResponse("VALIDATION_ERROR", "to_step is required", 400);
    return NextResponse.json(res.body, { status: res.status });
  }

  const task = await findTaskById(taskId);
  if (!task) {
    const res = errorResponse("NOT_FOUND", "태스크를 찾을 수 없습니다", 404);
    return NextResponse.json(res.body, { status: res.status });
  }

  const targetNode = await findWorkflowNodeByStep(task.workflow_id, to_step);
  if (!targetNode) {
    const res = errorResponse(
      "NOT_FOUND",
      `스텝 ${to_step}을 찾을 수 없습니다`,
      404,
    );
    return NextResponse.json(res.body, { status: res.status });
  }

  await rewindTaskToStep({ task, targetNode, toStep: to_step });

  const comments = await listTaskComments(taskId, to_step);
  const wfInfo = await getWorkflowTaskInfo(task.workflow_id);

  const res = okResponse({
    task_id: taskId,
    rewound_to: to_step,
    total_steps: wfInfo.node_count,
    current_step: await resolveTaskNodeResponse(targetNode, authResult),
    comments: comments.length > 0 ? comments : null,
  });
  return NextResponse.json(res.body, { status: res.status });
}
