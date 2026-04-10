import { NextResponse } from "next/server";
import { queryOne, type Folder, okResponse, errorResponse } from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import { canTransferOwnership, loadFolder } from "@/lib/authorization";

type Params = { params: Promise<{ id: string }> };

export const POST = withAuth<Params>(
  "workflows:update",
  async (request, user, { params }) => {
    const { id } = await params;
    const { new_owner_id } = await request.json();
    if (typeof new_owner_id !== "number") {
      const res = errorResponse("VALIDATION_ERROR", "new_owner_id required", 400);
      return NextResponse.json(res.body, { status: res.status });
    }
    const folder = await loadFolder(Number(id));
    if (!folder) {
      const res = errorResponse("NOT_FOUND", "폴더를 찾을 수 없습니다", 404);
      return NextResponse.json(res.body, { status: res.status });
    }
    // canTransferOwnership expects OwnedResource shape; folder has same fields relevant here.
    if (
      !(await canTransferOwnership(user, {
        id: folder.id,
        owner_id: folder.owner_id,
        folder_id: folder.id,
        visibility_override: null,
      }))
    ) {
      const res = errorResponse("OWNERSHIP_REQUIRED", "이전 권한 없음", 403);
      return NextResponse.json(res.body, { status: res.status });
    }
    const target = await queryOne<{ id: number }>(
      "SELECT id FROM users WHERE id = $1 AND is_active = true",
      [new_owner_id],
    );
    if (!target) {
      const res = errorResponse("NOT_FOUND", "대상 사용자가 없습니다", 404);
      return NextResponse.json(res.body, { status: res.status });
    }
    const updated = await queryOne<Folder>(
      "UPDATE folders SET owner_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [new_owner_id, Number(id)],
    );
    const res = okResponse(updated);
    return NextResponse.json(res.body, { status: res.status });
  },
);
