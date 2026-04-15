import { NextResponse } from "next/server";
import {
  execute,
  query,
  queryOne,
  type WorkflowShare,
  type Visibility,
  okResponse,
  listResponse,
  errorResponse,
} from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import { canEdit, canManageWorkflowShares } from "@/lib/authorization";

type Params = { params: Promise<{ id: string }> };

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

export const GET = withAuth<Params>(
  "workflows:read",
  async (_request, user, { params }) => {
    const { id } = await params;
    const workflow = await loadWorkflow(Number(id));
    if (!workflow) {
      const res = errorResponse("NOT_FOUND", "워크플로 없음", 404);
      return NextResponse.json(res.body, { status: res.status });
    }
    if (!(await canEdit(user, workflow))) {
      const res = errorResponse("OWNERSHIP_REQUIRED", "접근 거부", 403);
      return NextResponse.json(res.body, { status: res.status });
    }
    const rows = await query<WorkflowShare & { group_name: string }>(
      `SELECT ws.*, ug.name AS group_name
         FROM workflow_shares ws
         JOIN user_groups ug ON ug.id = ws.group_id
         WHERE ws.workflow_id = $1
         ORDER BY ug.name ASC`,
      [Number(id)],
    );
    const res = listResponse(rows, rows.length);
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const POST = withAuth<Params>(
  "workflows:update",
  async (request, user, { params }) => {
    const { id } = await params;
    const { group_id, access_level } = await request.json();
    if (typeof group_id !== "number") {
      const res = errorResponse("VALIDATION_ERROR", "group_id required", 400);
      return NextResponse.json(res.body, { status: res.status });
    }
    if (!["reader", "contributor"].includes(access_level)) {
      const res = errorResponse(
        "VALIDATION_ERROR",
        "invalid access_level",
        400,
      );
      return NextResponse.json(res.body, { status: res.status });
    }
    const workflow = await loadWorkflow(Number(id));
    if (!workflow) {
      const res = errorResponse("NOT_FOUND", "워크플로 없음", 404);
      return NextResponse.json(res.body, { status: res.status });
    }
    if (!(await canManageWorkflowShares(user, workflow))) {
      const res = errorResponse(
        "OWNERSHIP_REQUIRED",
        "공유 관리 권한 없음",
        403,
      );
      return NextResponse.json(res.body, { status: res.status });
    }
    await execute(
      `INSERT INTO workflow_shares (workflow_id, group_id, access_level)
       VALUES ($1, $2, $3)
       ON CONFLICT (workflow_id, group_id)
       DO UPDATE SET access_level = EXCLUDED.access_level`,
      [Number(id), group_id, access_level],
    );
    const row = await queryOne<WorkflowShare>(
      "SELECT * FROM workflow_shares WHERE workflow_id = $1 AND group_id = $2",
      [Number(id), group_id],
    );
    const res = okResponse(row, 201);
    return NextResponse.json(res.body, { status: res.status });
  },
);
