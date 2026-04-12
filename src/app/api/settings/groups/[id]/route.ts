import { NextResponse } from "next/server";
import { execute, okResponse, errorResponse } from "@/lib/db";
import { withAuth } from "@/lib/with-auth";

type Params = { params: Promise<{ id: string }> };

export const DELETE = withAuth<Params>(
  "users:write",
  async (_request, _user, { params }: Params) => {
    const { id } = await params;
    const groupId = Number(id);
    if (!groupId) {
      const res = errorResponse("VALIDATION_ERROR", "invalid group id", 400);
      return NextResponse.json(res.body, { status: res.status });
    }
    // members rows are deleted via ON DELETE CASCADE on user_group_members
    await execute("DELETE FROM user_groups WHERE id = $1", [groupId]);
    const res = okResponse({ deleted: true });
    return NextResponse.json(res.body, { status: res.status });
  },
);
