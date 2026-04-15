import { NextResponse } from "next/server";
import { execute, queryOne, type Workflow, okResponse, errorResponse } from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import { canEdit } from "@/lib/authorization";

type Params = { params: Promise<{ id: string }> };

export const POST = withAuth<Params>(
  "workflows:update",
  async (request, user, { params }) => {
    const { id } = await params;
    const { override } = await request.json();
    if (
      override !== null &&
      !["personal", "group", "public"].includes(override)
    ) {
      const res = errorResponse(
        "VALIDATION_ERROR",
        "override must be 'personal', 'group', 'public', or null",
        400,
      );
      return NextResponse.json(res.body, { status: res.status });
    }
    const workflow = await queryOne<Workflow>(
      "SELECT * FROM workflows WHERE id = $1",
      [Number(id)],
    );
    if (!workflow) {
      const res = errorResponse("NOT_FOUND", "워크플로 없음", 404);
      return NextResponse.json(res.body, { status: res.status });
    }
    if (!(await canEdit(user, workflow))) {
      const res = errorResponse("OWNERSHIP_REQUIRED", "권한 없음", 403);
      return NextResponse.json(res.body, { status: res.status });
    }
    await execute(
      "UPDATE workflows SET visibility_override = $1, updated_at = $2 WHERE id = $3",
      [override, new Date().toISOString(), Number(id)],
    );
    const updated = await queryOne<Workflow>(
      "SELECT * FROM workflows WHERE id = $1",
      [Number(id)],
    );
    const res = okResponse(updated);
    return NextResponse.json(res.body, { status: res.status });
  },
);
