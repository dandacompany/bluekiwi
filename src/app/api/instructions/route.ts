import { NextRequest, NextResponse } from "next/server";
import {
  query,
  queryOne,
  insert,
  Instruction,
  okResponse,
  listResponse,
  errorResponse,
} from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import {
  buildResourceVisibilityFilter,
  canEditFolder,
  loadFolder,
} from "@/lib/authorization";

export const GET = withAuth("workflows:read", async (request, user) => {
  const url = new URL(request.url);
  const folderId = url.searchParams.get("folder_id");
  const filter = await buildResourceVisibilityFilter("i", user, 1);
  const params: unknown[] = [...filter.params];
  const clauses = [filter.sql];
  if (folderId) {
    params.push(Number(folderId));
    clauses.push(`i.folder_id = $${params.length}`);
  }
  const rows = await query<Instruction>(
    `SELECT i.* FROM instructions i WHERE ${clauses.join(" AND ")} ORDER BY i.updated_at DESC`,
    params,
  );
  const res = listResponse(rows, rows.length);
  return NextResponse.json(res.body, { status: res.status });
});

export const POST = withAuth(
  "workflows:create",
  async (request: NextRequest, user) => {
    const body = await request.json();
    const { title, content, agent_type, tags, priority } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      const res = errorResponse("VALIDATION_ERROR", "title is required", 400);
      return NextResponse.json(res.body, { status: res.status });
    }

    // Resolve target folder: user-provided or default to Public Library
    let targetFolderId: number;
    if (typeof body.folder_id === "number") {
      const f = await loadFolder(body.folder_id);
      if (!f) {
        const res = errorResponse("NOT_FOUND", "folder not found", 404);
        return NextResponse.json(res.body, { status: res.status });
      }
      if (!(await canEditFolder(user, f))) {
        const res = errorResponse(
          "OWNERSHIP_REQUIRED",
          "폴더 편집 권한 없음",
          403,
        );
        return NextResponse.json(res.body, { status: res.status });
      }
      targetFolderId = f.id;
    } else {
      const lib = await queryOne<{ id: number }>(
        "SELECT id FROM folders WHERE is_system = true AND visibility = 'public' LIMIT 1",
      );
      if (!lib) {
        const res = errorResponse(
          "VALIDATION_ERROR",
          "Public Library가 없습니다. 관리자에게 문의하세요",
          500,
        );
        return NextResponse.json(res.body, { status: res.status });
      }
      const f = await loadFolder(lib.id);
      if (!f) {
        const res = errorResponse("NOT_FOUND", "folder not found", 404);
        return NextResponse.json(res.body, { status: res.status });
      }
      if (!(await canEditFolder(user, f))) {
        const res = errorResponse(
          "OWNERSHIP_REQUIRED",
          "폴더 편집 권한 없음",
          403,
        );
        return NextResponse.json(res.body, { status: res.status });
      }
      targetFolderId = f.id;
    }

    const tagsJson = JSON.stringify(
      Array.isArray(tags) ? tags.map((t: string) => t.trim()) : [],
    );

    const instructionId = await insert(
      "INSERT INTO instructions (title, content, agent_type, tags, priority, owner_id, folder_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
      [
        title.trim(),
        (content ?? "").trim(),
        (agent_type ?? "general").trim(),
        tagsJson,
        typeof priority === "number" ? priority : 0,
        user.id,
        targetFolderId,
      ],
    );

    const created = await queryOne<Instruction>(
      "SELECT * FROM instructions WHERE id = $1",
      [instructionId],
    );

    const res = okResponse(created, 201);
    return NextResponse.json(res.body, { status: res.status });
  },
);
