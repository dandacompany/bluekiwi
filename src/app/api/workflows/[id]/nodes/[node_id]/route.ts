import { NextRequest, NextResponse } from "next/server";
import { Workflow, okResponse, errorResponse } from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import { canEdit } from "@/lib/authorization";
import { loadResourceOrFail } from "@/lib/api-helpers";
import {
  deleteWorkflowNode,
  findWorkflowNodeById,
  updateWorkflowNode,
  WorkflowNodeDeletionBlockedError,
} from "@/lib/db/repositories/workflow-nodes";

type Params = { params: Promise<{ id: string; node_id: string }> };

export const PATCH = withAuth<Params>(
  "workflows:update",
  async (request: NextRequest, user, { params }: Params) => {
    const { id, node_id } = await params;
    const workflowId = Number(id);
    const nodeId = Number(node_id);

    const { resource: workflow, response: errResp } =
      await loadResourceOrFail<Workflow>({
        table: "workflows",
        id: workflowId,
        user,
        check: canEdit,
        notFoundMessage: "워크플로를 찾을 수 없습니다",
        forbiddenMessage: "편집 권한 없음",
      });
    if (errResp) return errResp;
    void workflow;

    const existing = await findWorkflowNodeById(nodeId, workflowId);
    if (!existing) {
      const res = errorResponse("NOT_FOUND", "노드를 찾을 수 없습니다", 404);
      return NextResponse.json(res.body, { status: res.status });
    }

    const body = await request.json();
    const updated = await updateWorkflowNode({
      workflowId,
      nodeId,
      body,
    });
    const res = okResponse(updated);
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const DELETE = withAuth<Params>(
  "workflows:update",
  async (_request: NextRequest, user, { params }: Params) => {
    const { id, node_id } = await params;
    const workflowId = Number(id);
    const nodeId = Number(node_id);

    const { resource: workflow, response: errResp } =
      await loadResourceOrFail<Workflow>({
        table: "workflows",
        id: workflowId,
        user,
        check: canEdit,
        notFoundMessage: "워크플로를 찾을 수 없습니다",
        forbiddenMessage: "편집 권한 없음",
      });
    if (errResp) return errResp;
    void workflow;

    let deleted: boolean;
    try {
      deleted = await deleteWorkflowNode({ workflowId, nodeId });
    } catch (error) {
      if (error instanceof WorkflowNodeDeletionBlockedError) {
        const res = errorResponse(
          "CONFLICT",
          `실행 로그가 남아 있는 노드는 삭제할 수 없습니다 (task_logs: ${error.referenceCount})`,
          409,
        );
        return NextResponse.json(res.body, { status: res.status });
      }
      throw error;
    }
    if (!deleted) {
      const res = errorResponse("NOT_FOUND", "노드를 찾을 수 없습니다", 404);
      return NextResponse.json(res.body, { status: res.status });
    }

    const res = okResponse({ id: nodeId, deleted: true });
    return NextResponse.json(res.body, { status: res.status });
  },
);
