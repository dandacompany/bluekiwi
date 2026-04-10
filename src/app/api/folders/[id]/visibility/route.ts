import { NextResponse } from "next/server";
import { queryOne, type Folder, okResponse, errorResponse } from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import { canChangeFolderVisibility, loadFolder } from "@/lib/authorization";

type Params = { params: Promise<{ id: string }> };

export const POST = withAuth<Params>(
  "workflows:update",
  async (request, user, { params }) => {
    const { id } = await params;
    const body = await request.json();
    const { visibility } = body;

    if (!["personal", "group", "public"].includes(visibility)) {
      const res = errorResponse("VALIDATION_ERROR", "invalid visibility", 400);
      return NextResponse.json(res.body, { status: res.status });
    }

    const folder = await loadFolder(Number(id));
    if (!folder) {
      const res = errorResponse("NOT_FOUND", "폴더를 찾을 수 없습니다", 404);
      return NextResponse.json(res.body, { status: res.status });
    }

    if (!(await canChangeFolderVisibility(user, folder, visibility))) {
      const code =
        visibility === "public" || folder.visibility === "public"
          ? "VISIBILITY_GATE"
          : "OWNERSHIP_REQUIRED";
      const res = errorResponse(code, "visibility 변경 권한 없음", 403);
      return NextResponse.json(res.body, { status: res.status });
    }

    const updated = await queryOne<Folder>(
      "UPDATE folders SET visibility = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [visibility, Number(id)],
    );
    const res = okResponse(updated);
    return NextResponse.json(res.body, { status: res.status });
  },
);
