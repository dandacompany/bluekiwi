import { NextResponse } from "next/server";
import {
  query,
  queryOne,
  type FolderShare,
  okResponse,
  listResponse,
  errorResponse,
} from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import {
  canReadFolder,
  canManageFolderShares,
  loadFolder,
} from "@/lib/authorization";

type Params = { params: Promise<{ id: string }> };

export const GET = withAuth<Params>(
  "workflows:read",
  async (_request, user, { params }) => {
    const { id } = await params;
    const folder = await loadFolder(Number(id));
    if (!folder) {
      const res = errorResponse("NOT_FOUND", "폴더 없음", 404);
      return NextResponse.json(res.body, { status: res.status });
    }
    if (!(await canReadFolder(user, folder))) {
      const res = errorResponse("OWNERSHIP_REQUIRED", "접근 거부", 403);
      return NextResponse.json(res.body, { status: res.status });
    }
    const rows = await query<FolderShare & { group_name: string }>(
      `SELECT fs.*, ug.name AS group_name
         FROM folder_shares fs
         JOIN user_groups ug ON ug.id = fs.group_id
         WHERE fs.folder_id = $1
         ORDER BY ug.name ASC`,
      [Number(id)],
    );
    const res = listResponse(rows, rows.length);
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const POST = withAuth<Params>(
  "workflows:update",
  async (request, user, { params }) => {
    const { id } = await params;
    const { group_id, access_level } = await request.json();
    if (typeof group_id !== "number") {
      const res = errorResponse("VALIDATION_ERROR", "group_id required", 400);
      return NextResponse.json(res.body, { status: res.status });
    }
    if (!["viewer", "editor"].includes(access_level)) {
      const res = errorResponse("VALIDATION_ERROR", "invalid access_level", 400);
      return NextResponse.json(res.body, { status: res.status });
    }
    const folder = await loadFolder(Number(id));
    if (!folder) {
      const res = errorResponse("NOT_FOUND", "폴더 없음", 404);
      return NextResponse.json(res.body, { status: res.status });
    }
    if (!(await canManageFolderShares(user, folder))) {
      const res = errorResponse(
        "FOLDER_SHARE_DENIED",
        "공유 관리 권한 없음",
        403,
      );
      return NextResponse.json(res.body, { status: res.status });
    }
    const row = await queryOne<FolderShare>(
      `INSERT INTO folder_shares (folder_id, group_id, access_level)
       VALUES ($1, $2, $3)
       ON CONFLICT (folder_id, group_id)
       DO UPDATE SET access_level = EXCLUDED.access_level
       RETURNING *`,
      [Number(id), group_id, access_level],
    );
    const res = okResponse(row, 201);
    return NextResponse.json(res.body, { status: res.status });
  },
);
