import { NextRequest, NextResponse } from "next/server";
import { Workflow, okResponse, errorResponse } from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import { canEdit } from "@/lib/authorization";
import { loadResourceOrFail } from "@/lib/api-helpers";
import { createWorkflowNode } from "@/lib/db/repositories/workflow-nodes";

type Params = { params: Promise<{ id: string }> };

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

    const newNode = await createWorkflowNode({
      workflowId,
      afterStep,
      node: {
        title,
        instruction,
        instruction_id,
        credential_id,
        credential_requirement,
        hitl,
        visual_selection,
        loop_back_to,
        node_type,
      },
    });

    const res = okResponse(newNode, 201);
    return NextResponse.json(res.body, { status: res.status });
  },
);
