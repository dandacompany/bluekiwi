import { NextResponse } from "next/server";
import {
  execute,
  queryOne,
  type Visibility,
  okResponse,
  errorResponse,
} from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import { canManageWorkflowShares } from "@/lib/authorization";

type Params = { params: Promise<{ id: string; groupId: string }> };

async function loadWorkflow(id: number) {
  return queryOne<{
    id: number;
    owner_id: number;
    folder_id: number;
    visibility_override: Visibility | null;
  }>(
    "SELECT id, owner_id, folder_id, visibility_override FROM workflows WHERE id = $1",
    [id],
  );
}

export const DELETE = withAuth<Params>(
  "workflows:update",
  async (_request, user, { params }) => {
    const { id, groupId } = await params;
    const workflow = await loadWorkflow(Number(id));
    if (!workflow) {
      const res = errorResponse("NOT_FOUND", "워크플로 없음", 404);
      return NextResponse.json(res.body, { status: res.status });
    }
    if (!(await canManageWorkflowShares(user, workflow))) {
      const res = errorResponse("OWNERSHIP_REQUIRED", "권한 없음", 403);
      return NextResponse.json(res.body, { status: res.status });
    }
    const result = await execute(
      "DELETE FROM workflow_shares WHERE workflow_id = $1 AND group_id = $2",
      [Number(id), Number(groupId)],
    );
    const res = okResponse({ removed: result.rowCount > 0 });
    return NextResponse.json(res.body, { status: res.status });
  },
);
