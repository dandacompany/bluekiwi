import { NextRequest, NextResponse } from "next/server";
import {
  queryOne,
  withTransaction,
  Workflow,
  WorkflowNode,
  okResponse,
  errorResponse,
} from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import { canEdit } from "@/lib/authorization";
import { loadResourceOrFail } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string; nodeId: string }> };

function enforceAutoAdvance(nodeType: string): number {
  if (nodeType === "action") return 1;
  if (nodeType === "gate") return 0;
  return 0;
}

export const PATCH = withAuth<Params>(
  "workflows:update",
  async (request: NextRequest, user, { params }: Params) => {
    const { id, nodeId } = await params;
    const workflowId = Number(id);
    const resolvedNodeId = Number(nodeId);

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

    const existing = await queryOne<WorkflowNode>(
      "SELECT * FROM workflow_nodes WHERE id = $1 AND workflow_id = $2",
      [resolvedNodeId, workflowId],
    );
    if (!existing) {
      const res = errorResponse("NOT_FOUND", "노드를 찾을 수 없습니다", 404);
      return NextResponse.json(res.body, { status: res.status });
    }

    const body = await request.json();
    const newNodeType = body.node_type ?? existing.node_type;
    const autoAdvance = enforceAutoAdvance(newNodeType);

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE workflow_nodes SET
           title = COALESCE($1, title),
           instruction = COALESCE($2, instruction),
           node_type = $3,
           auto_advance = $4,
           hitl = COALESCE($5, hitl),
           visual_selection = COALESCE($6, visual_selection),
           instruction_id = COALESCE($7, instruction_id),
           credential_id = COALESCE($8, credential_id),
           loop_back_to = COALESCE($9, loop_back_to),
           credential_requirement = COALESCE($10, credential_requirement)
         WHERE id = $11`,
        [
          body.title ?? null,
          body.instruction ?? null,
          newNodeType,
          autoAdvance,
          body.hitl ?? null,
          body.visual_selection != null
            ? newNodeType === "gate"
              ? body.visual_selection
              : false
            : null,
          body.instruction_id ?? null,
          body.credential_id ?? null,
          body.loop_back_to ?? null,
          body.credential_requirement
            ? JSON.stringify(body.credential_requirement)
            : null,
          resolvedNodeId,
        ],
      );
    });

    const updated = await queryOne<WorkflowNode>(
      "SELECT * FROM workflow_nodes WHERE id = $1",
      [resolvedNodeId],
    );
    const res = okResponse(updated);
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const DELETE = withAuth<Params>(
  "workflows:update",
  async (_request: NextRequest, user, { params }: Params) => {
    const { id, nodeId } = await params;
    const workflowId = Number(id);
    const resolvedNodeId = Number(nodeId);

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

    const existing = await queryOne<{ step_order: number }>(
      "SELECT step_order FROM workflow_nodes WHERE id = $1 AND workflow_id = $2",
      [resolvedNodeId, workflowId],
    );
    if (!existing) {
      const res = errorResponse("NOT_FOUND", "노드를 찾을 수 없습니다", 404);
      return NextResponse.json(res.body, { status: res.status });
    }

    await withTransaction(async (client) => {
      await client.query("DELETE FROM workflow_nodes WHERE id = $1", [
        resolvedNodeId,
      ]);
      await client.query(
        "UPDATE workflow_nodes SET step_order = step_order - 1 WHERE workflow_id = $1 AND step_order > $2",
        [workflowId, existing.step_order],
      );
    });

    const res = okResponse({ id: resolvedNodeId, deleted: true });
    return NextResponse.json(res.body, { status: res.status });
  },
);
