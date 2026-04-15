import { NextRequest, NextResponse } from "next/server";
import { Workflow, okResponse, errorResponse } from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import { canEdit } from "@/lib/authorization";
import { activateWorkflowVersion, findWorkflowById } from "@/lib/db/repositories/workflows";

type Params = { params: Promise<{ id: string }> };

export const POST = withAuth<Params>(
  "workflows:update",
  async (_request: NextRequest, user, { params }: Params) => {
    const { id } = await params;
    const workflowId = Number(id);

    const target = await findWorkflowById(workflowId);
    if (!target) {
      const res = errorResponse(
        "NOT_FOUND",
        "워크플로를 찾을 수 없습니다",
        404,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    if (!(await canEdit(user, target))) {
      const res = errorResponse("OWNERSHIP_REQUIRED", "편집 권한 없음", 403);
      return NextResponse.json(res.body, { status: res.status });
    }

    if (target.is_active) {
      const res = okResponse({
        id: target.id,
        family_root_id: target.family_root_id,
        is_active: true,
        already_active: true,
      });
      return NextResponse.json(res.body, { status: res.status });
    }

    const updated = await activateWorkflowVersion(target);

    const res = okResponse({
      id: updated.id,
      family_root_id: updated.family_root_id,
      is_active: updated.is_active,
      already_active: false,
    });
    return NextResponse.json(res.body, { status: res.status });
  },
);
