import { NextResponse } from "next/server";
import { type Folder, okResponse, listResponse, errorResponse } from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import {
  buildFolderVisibilityFilter,
  canEditFolder,
  loadFolder,
} from "@/lib/authorization";
import { createFolder, listFoldersForVisibilityFilter } from "@/lib/db/repositories/folders";

export const GET = withAuth("workflows:read", async (request, user) => {
  const parentId = new URL(request.url).searchParams.get("parent_id");
  const filter = await buildFolderVisibilityFilter("f", user, 1);
  // Personal system folders (e.g. "My Workspace") are always owner-only,
  // even for admin/superuser — each user sees only their own.
  const folders = await listFoldersForVisibilityFilter(
    filter.sql,
    filter.params,
    user.id,
    parentId === null ? undefined : parentId === "null" ? null : Number(parentId),
  );
  const res = listResponse(folders, folders.length);
  return NextResponse.json(res.body, { status: res.status });
});

export const POST = withAuth("workflows:create", async (request, user) => {
  const body = await request.json();
  const {
    name,
    description = "",
    parent_id = null,
    visibility = "personal",
  } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    const res = errorResponse("VALIDATION_ERROR", "name is required", 400);
    return NextResponse.json(res.body, { status: res.status });
  }
  if (!["personal", "group", "public", "inherit"].includes(visibility)) {
    const res = errorResponse("VALIDATION_ERROR", "invalid visibility", 400);
    return NextResponse.json(res.body, { status: res.status });
  }

  if (visibility === "inherit" && parent_id === null) {
    const res = errorResponse(
      "VALIDATION_ERROR",
      "최상위 폴더는 '폴더따름'을 사용할 수 없습니다",
      400,
    );
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
    // Enforce child visibility <= parent visibility (skip for 'inherit')
    const rank = { personal: 0, group: 1, public: 2 } as const;
    if (
      visibility !== "inherit" &&
      rank[visibility as "personal" | "group" | "public"] >
        rank[parent.visibility as "personal" | "group" | "public"]
    ) {
      const res = errorResponse(
        "FOLDER_VISIBILITY_INVALID",
        "자식 폴더는 부모보다 더 넓은 visibility를 가질 수 없습니다",
        400,
      );
      return NextResponse.json(res.body, { status: res.status });
    }
  }

  const row = await createFolder({
    name: name.trim(),
    description,
    ownerId: user.id,
    parentId: parent_id,
    visibility,
  });
  const res = okResponse(row, 201);
  return NextResponse.json(res.body, { status: res.status });
});
