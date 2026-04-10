import { NextResponse } from "next/server";
import {
  queryOne,
  type Instruction,
  okResponse,
  errorResponse,
} from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import { canEdit } from "@/lib/authorization";

type Params = { params: Promise<{ id: string }> };

export const POST = withAuth<Params>(
  "workflows:update",
  async (request, user, { params }) => {
    const { id } = await params;
    const { override } = await request.json();
    if (override !== null && override !== "personal") {
      const res = errorResponse("VALIDATION_ERROR", "invalid override", 400);
      return NextResponse.json(res.body, { status: res.status });
    }
    const inst = await queryOne<Instruction>(
      "SELECT * FROM instructions WHERE id = $1",
      [Number(id)],
    );
    if (!inst) {
      const res = errorResponse("NOT_FOUND", "인스트럭션 없음", 404);
      return NextResponse.json(res.body, { status: res.status });
    }
    if (!(await canEdit(user, inst))) {
      const res = errorResponse("OWNERSHIP_REQUIRED", "권한 없음", 403);
      return NextResponse.json(res.body, { status: res.status });
    }
    const updated = await queryOne<Instruction>(
      "UPDATE instructions SET visibility_override = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [override, Number(id)],
    );
    const res = okResponse(updated);
    return NextResponse.json(res.body, { status: res.status });
  },
);
