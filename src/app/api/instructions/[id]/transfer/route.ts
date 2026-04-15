import { NextResponse } from "next/server";
import { type Instruction, okResponse, errorResponse } from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import { canTransferOwnership } from "@/lib/authorization";
import { findActiveUserById } from "@/lib/db/repositories/auth";
import { findInstructionById, transferInstructionOwnership } from "@/lib/db/repositories/instructions";

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
    const inst = await findInstructionById(Number(id));
    if (!inst) {
      const res = errorResponse("NOT_FOUND", "인스트럭션 없음", 404);
      return NextResponse.json(res.body, { status: res.status });
    }
    if (!(await canTransferOwnership(user, inst))) {
      const res = errorResponse("OWNERSHIP_REQUIRED", "이전 권한 없음", 403);
      return NextResponse.json(res.body, { status: res.status });
    }
    const target = await findActiveUserById(new_owner_id);
    if (!target) {
      const res = errorResponse("NOT_FOUND", "대상 사용자 없음", 404);
      return NextResponse.json(res.body, { status: res.status });
    }
    const updated = await transferInstructionOwnership({
      id: Number(id),
      newOwnerId: new_owner_id,
    });
    const res = okResponse(updated);
    return NextResponse.json(res.body, { status: res.status });
  },
);
