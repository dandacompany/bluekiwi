import { NextResponse } from "next/server";
import { type Workflow, okResponse, errorResponse } from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import { canTransferOwnership } from "@/lib/authorization";
import { findActiveUserById } from "@/lib/db/repositories/auth";
import { findWorkflowById, transferWorkflowOwnership } from "@/lib/db/repositories/workflows";

type Params = { params: Promise<{ id: string }> };

export const POST = withAuth<Params>(
  "workflows:update",
  async (request, user, { params }) => {
    const { id } = await params;
    const { new_owner_id } = await request.json();
    if (typeof new_owner_id !== "number") {
      const res = errorResponse(
        "VALIDATION_ERROR",
        "new_owner_id required",
        400,
      );
      return NextResponse.json(res.body, { status: res.status });
    }
    const workflow = await findWorkflowById(Number(id));
    if (!workflow) {
      const res = errorResponse("NOT_FOUND", "워크플로 없음", 404);
      return NextResponse.json(res.body, { status: res.status });
    }
    if (!(await canTransferOwnership(user, workflow))) {
      const res = errorResponse("OWNERSHIP_REQUIRED", "이전 권한 없음", 403);
      return NextResponse.json(res.body, { status: res.status });
    }
    const target = await findActiveUserById(new_owner_id);
    if (!target) {
      const res = errorResponse("NOT_FOUND", "대상 사용자 없음", 404);
      return NextResponse.json(res.body, { status: res.status });
    }
    const updated = await transferWorkflowOwnership({
      workflowId: Number(id),
      newOwnerId: new_owner_id,
    });
    const res = okResponse(updated);
    return NextResponse.json(res.body, { status: res.status });
  },
);
