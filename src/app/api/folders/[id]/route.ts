import { NextResponse } from "next/server";
import {
  queryOne,
  execute,
  type Folder,
  okResponse,
  errorResponse,
} from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import {
  canReadFolder,
  canEditFolder,
  canDeleteFolder,
  loadFolder,
} from "@/lib/authorization";

type Params = { params: Promise<{ id: string }> };

export const GET = withAuth<Params>(
  "workflows:read",
  async (_request, user, { params }) => {
    const { id } = await params;
    const folder = await loadFolder(Number(id));
    if (!folder) {
      const res = errorResponse("NOT_FOUND", "폴더를 찾을 수 없습니다", 404);
      return NextResponse.json(res.body, { status: res.status });
    }
    if (!(await canReadFolder(user, folder))) {
      const res = errorResponse("OWNERSHIP_REQUIRED", "접근 권한 없음", 403);
      return NextResponse.json(res.body, { status: res.status });
    }
    const full = await queryOne<Folder>("SELECT * FROM folders WHERE id = $1", [
      Number(id),
    ]);
    const res = okResponse(full);
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const PUT = withAuth<Params>(
  "workflows:update",
  async (request, user, { params }) => {
    const { id } = await params;
    const body = await request.json();
    const { name, description, parent_id } = body;

    const folder = await loadFolder(Number(id));
    if (!folder) {
      const res = errorResponse("NOT_FOUND", "폴더를 찾을 수 없습니다", 404);
      return NextResponse.json(res.body, { status: res.status });
    }
    if (!(await canEditFolder(user, folder))) {
      const res = errorResponse("OWNERSHIP_REQUIRED", "편집 권한 없음", 403);
      return NextResponse.json(res.body, { status: res.status });
    }
    if (folder.is_system && (name !== undefined || parent_id !== undefined)) {
      const res = errorResponse(
        "OWNERSHIP_REQUIRED",
        "시스템 폴더의 이름/위치는 변경할 수 없습니다",
        403,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    const updated = await queryOne<Folder>(
      `UPDATE folders SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         parent_id = COALESCE($3, parent_id),
         updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [name ?? null, description ?? null, parent_id ?? null, Number(id)],
    );
    const res = okResponse(updated);
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const DELETE = withAuth<Params>(
  "workflows:delete",
  async (_request, user, { params }) => {
    const { id } = await params;
    const folder = await loadFolder(Number(id));
    if (!folder) {
      const res = errorResponse("NOT_FOUND", "폴더를 찾을 수 없습니다", 404);
      return NextResponse.json(res.body, { status: res.status });
    }
    if (!(await canDeleteFolder(user, folder))) {
      const res = errorResponse("OWNERSHIP_REQUIRED", "삭제 권한 없음", 403);
      return NextResponse.json(res.body, { status: res.status });
    }

    // Emptiness check — consolidated into a single round trip
    const usage = await queryOne<{
      workflow_count: number;
      instruction_count: number;
      credential_count: number;
      child_count: number;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM workflows    WHERE folder_id = $1)::int AS workflow_count,
         (SELECT COUNT(*) FROM instructions WHERE folder_id = $1)::int AS instruction_count,
         (SELECT COUNT(*) FROM credentials  WHERE folder_id = $1)::int AS credential_count,
         (SELECT COUNT(*) FROM folders      WHERE parent_id = $1)::int AS child_count`,
      [Number(id)],
    );
    const total =
      (usage?.workflow_count ?? 0) +
      (usage?.instruction_count ?? 0) +
      (usage?.credential_count ?? 0) +
      (usage?.child_count ?? 0);

    if (total > 0) {
      const res = errorResponse(
        "FOLDER_NOT_EMPTY",
        "비어있지 않은 폴더는 삭제할 수 없습니다",
        409,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    await execute("DELETE FROM folders WHERE id = $1", [Number(id)]);
    const res = okResponse({ id: Number(id), deleted: true });
    return NextResponse.json(res.body, { status: res.status });
  },
);
