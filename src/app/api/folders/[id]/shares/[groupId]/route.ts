import { NextResponse } from "next/server";
import { execute, okResponse, errorResponse } from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import { canManageFolderShares, loadFolder } from "@/lib/authorization";

type Params = { params: Promise<{ id: string; groupId: string }> };

export const DELETE = withAuth<Params>(
  "workflows:update",
  async (_request, user, { params }) => {
    const { id, groupId } = await params;
    const folder = await loadFolder(Number(id));
    if (!folder) {
      const res = errorResponse("NOT_FOUND", "폴더 없음", 404);
      return NextResponse.json(res.body, { status: res.status });
    }
    if (!(await canManageFolderShares(user, folder))) {
      const res = errorResponse("FOLDER_SHARE_DENIED", "권한 없음", 403);
      return NextResponse.json(res.body, { status: res.status });
    }
    const result = await execute(
      "DELETE FROM folder_shares WHERE folder_id = $1 AND group_id = $2",
      [Number(id), Number(groupId)],
    );
    const res = okResponse({ removed: result.rowCount > 0 });
    return NextResponse.json(res.body, { status: res.status });
  },
);
