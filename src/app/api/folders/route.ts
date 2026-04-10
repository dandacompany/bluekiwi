import { NextResponse } from "next/server";
import {
  query,
  queryOne,
  type Folder,
  okResponse,
  listResponse,
  errorResponse,
} from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import {
  buildFolderVisibilityFilter,
  canEditFolder,
  loadFolder,
} from "@/lib/authorization";

export const GET = withAuth("workflows:read", async (request, user) => {
  const parentId = new URL(request.url).searchParams.get("parent_id");
  const filter = await buildFolderVisibilityFilter("f", user, 1);
  let sql = `SELECT f.* FROM folders f WHERE ${filter.sql}`;
  const params = [...filter.params];
  if (parentId !== null) {
    params.push(parentId === "null" ? null : Number(parentId));
    sql += ` AND f.parent_id ${parentId === "null" ? "IS NULL" : `= $${params.length}`}`;
  }
  sql += " ORDER BY f.name ASC";
  const folders = await query<Folder>(sql, params);
  const res = listResponse(folders, folders.length);
  return NextResponse.json(res.body, { status: res.status });
});

export const POST = withAuth("workflows:create", async (request, user) => {
  const body = await request.json();
  const { name, description = "", parent_id = null, visibility = "personal" } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    const res = errorResponse("VALIDATION_ERROR", "name is required", 400);
    return NextResponse.json(res.body, { status: res.status });
  }
  if (!["personal", "group", "public"].includes(visibility)) {
    const res = errorResponse("VALIDATION_ERROR", "invalid visibility", 400);
    return NextResponse.json(res.body, { status: res.status });
  }

  // Only admin/superuser can create public folders.
  if (visibility === "public" && !["admin", "superuser"].includes(user.role)) {
    const res = errorResponse(
      "VISIBILITY_GATE",
      "Public 폴더 생성은 관리자 권한이 필요합니다",
      403,
    );
    return NextResponse.json(res.body, { status: res.status });
  }

  // If nesting, verify parent and canEditFolder(parent).
  if (parent_id !== null) {
    const parent = await loadFolder(Number(parent_id));
    if (!parent) {
      const res = errorResponse("NOT_FOUND", "parent folder not found", 404);
      return NextResponse.json(res.body, { status: res.status });
    }
    if (!(await canEditFolder(user, parent))) {
      const res = errorResponse(
        "OWNERSHIP_REQUIRED",
        "부모 폴더에 대한 편집 권한이 필요합니다",
        403,
      );
      return NextResponse.json(res.body, { status: res.status });
    }
    // Enforce child visibility <= parent visibility
    const rank = { personal: 0, group: 1, public: 2 } as const;
    if (rank[visibility as "personal" | "group" | "public"] > rank[parent.visibility]) {
      const res = errorResponse(
        "FOLDER_VISIBILITY_INVALID",
        "자식 폴더는 부모보다 더 넓은 visibility를 가질 수 없습니다",
        400,
      );
      return NextResponse.json(res.body, { status: res.status });
    }
  }

  const row = await queryOne<Folder>(
    `INSERT INTO folders (name, description, owner_id, parent_id, visibility)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [name.trim(), description, user.id, parent_id, visibility],
  );
  const res = okResponse(row, 201);
  return NextResponse.json(res.body, { status: res.status });
});
