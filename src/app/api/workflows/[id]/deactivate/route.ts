import { NextRequest, NextResponse } from "next/server";
import {
  queryOne,
  execute,
  Workflow,
  okResponse,
  errorResponse,
} from "@/lib/db";
import { withOptionalAuth } from "@/lib/with-auth";

type Params = { params: Promise<{ id: string }> };

export const POST = withOptionalAuth<Params>(
  "workflows:update",
  async (_request: NextRequest, _user, { params }: Params) => {
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

    if (!target.is_active) {
      const res = okResponse({
        id: target.id,
        family_root_id: target.family_root_id,
        is_active: false,
        already_inactive: true,
      });
      return NextResponse.json(res.body, { status: res.status });
    }

    await execute(
      "UPDATE workflows SET is_active = FALSE, updated_at = NOW() WHERE id = $1",
      [workflowId],
    );

    const res = okResponse({
      id: target.id,
      family_root_id: target.family_root_id,
      is_active: false,
      already_inactive: false,
    });
    return NextResponse.json(res.body, { status: res.status });
  },
);
