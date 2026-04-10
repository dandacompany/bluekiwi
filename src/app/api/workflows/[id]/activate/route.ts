import { NextRequest, NextResponse } from "next/server";
import {
  queryOne,
  withTransaction,
  Workflow,
  okResponse,
  errorResponse,
} from "@/lib/db";
import { withAuth } from "@/lib/with-auth";

type Params = { params: Promise<{ id: string }> };

export const POST = withAuth<Params>(
  "workflows:update",
  async (_request: NextRequest, user, { params }: Params) => {
    const { id } = await params;
    const workflowId = Number(id);

    const target = await queryOne<Workflow>(
      "SELECT * FROM workflows WHERE id = $1",
      [workflowId],
    );
    if (!target) {
      const res = errorResponse(
        "NOT_FOUND",
        "워크플로를 찾을 수 없습니다",
        404,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    const { canEdit } = await import("@/lib/authorization");
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

    const updated = await withTransaction(async (client) => {
      await client.query(
        `UPDATE workflows SET is_active = FALSE, updated_at = NOW()
          WHERE family_root_id = $1 AND is_active = TRUE`,
        [target.family_root_id],
      );
      await client.query(
        `UPDATE workflows SET is_active = TRUE, updated_at = NOW() WHERE id = $1`,
        [workflowId],
      );
      const { rows } = await client.query(
        "SELECT * FROM workflows WHERE id = $1",
        [workflowId],
      );
      return rows[0] as Workflow;
    });

    const res = okResponse({
      id: updated.id,
      family_root_id: updated.family_root_id,
      is_active: updated.is_active,
      already_active: false,
    });
    return NextResponse.json(res.body, { status: res.status });
  },
);
