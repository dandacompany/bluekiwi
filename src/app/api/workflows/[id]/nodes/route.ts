import { NextRequest, NextResponse } from "next/server";
import { withTransaction, Workflow, okResponse, errorResponse } from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import { canEdit } from "@/lib/authorization";
import { loadResourceOrFail } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

function enforceAutoAdvance(nodeType: string): number {
  if (nodeType === "action") return 1;
  if (nodeType === "gate") return 0;
  return 0;
}

export const POST = withAuth<Params>(
  "workflows:update",
  async (request: NextRequest, user, { params }: Params) => {
    const { id } = await params;
    const workflowId = Number(id);
    const url = new URL(request.url);
    const afterStr = url.searchParams.get("after");
    const afterStep = afterStr ? Number(afterStr) : null;

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

    const body = await request.json();
    const {
      title,
      instruction,
      node_type,
      hitl,
      visual_selection,
      loop_back_to,
      credential_id,
      credential_requirement,
      instruction_id,
    } = body;

    if (!title || !node_type) {
      const res = errorResponse(
        "VALIDATION_ERROR",
        "title and node_type are required",
        400,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    const resolvedNodeType = (node_type as string).trim();
    const autoAdvance = enforceAutoAdvance(resolvedNodeType);

    const newNode = await withTransaction(async (client) => {
      let newStepOrder: number;

      if (afterStep !== null) {
        await client.query(
          "UPDATE workflow_nodes SET step_order = step_order + 1 WHERE workflow_id = $1 AND step_order > $2",
          [workflowId, afterStep],
        );
        newStepOrder = afterStep + 1;
      } else {
        const maxRow = await client.query<{ max: number | null }>(
          "SELECT MAX(step_order) as max FROM workflow_nodes WHERE workflow_id = $1",
          [workflowId],
        );
        newStepOrder = (maxRow.rows[0]?.max ?? 0) + 1;
      }

      const { rows } = await client.query(
        `INSERT INTO workflow_nodes
           (workflow_id, step_order, node_type, title, instruction, instruction_id,
            loop_back_to, auto_advance, credential_id, hitl, visual_selection, credential_requirement)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          workflowId,
          newStepOrder,
          resolvedNodeType,
          title.trim(),
          (instruction ?? "").trim(),
          instruction_id ?? null,
          resolvedNodeType === "loop" ? (loop_back_to ?? null) : null,
          autoAdvance,
          credential_id ?? null,
          hitl ?? false,
          resolvedNodeType === "gate" ? (visual_selection ?? false) : false,
          credential_requirement
            ? JSON.stringify(credential_requirement)
            : null,
        ],
      );
      return rows[0];
    });

    const res = okResponse(newNode, 201);
    return NextResponse.json(res.body, { status: res.status });
  },
);
