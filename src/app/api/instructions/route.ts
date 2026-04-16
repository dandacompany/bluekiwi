import { NextRequest, NextResponse } from "next/server";
import { okResponse, listResponse, errorResponse } from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import {
  buildResourceVisibilityFilter,
  canEditFolder,
  loadFolder,
} from "@/lib/authorization";
import {
  createInstruction,
  findPersonalWorkspaceFolderIdForUser,
  listInstructionsForVisibilityFilter,
} from "@/lib/db/repositories/instructions";

export const GET = withAuth("workflows:read", async (request, user) => {
  const url = new URL(request.url);
  const folderId = url.searchParams.get("folder_id");
  const filter = await buildResourceVisibilityFilter("i", user, 1);
  const rows = await listInstructionsForVisibilityFilter(
    filter.sql,
    filter.params,
    folderId ? Number(folderId) : undefined,
  );
  const res = listResponse(rows, rows.length);
  return NextResponse.json(res.body, { status: res.status });
});

export const POST = withAuth(
  "workflows:create",
  async (request: NextRequest, user) => {
    const body = await request.json();
    const { title, content, agent_type, tags, priority, credential_id } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      const res = errorResponse("VALIDATION_ERROR", "title is required", 400);
      return NextResponse.json(res.body, { status: res.status });
    }

    // Resolve target folder: user-provided or default to user's My Workspace
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
      const workspaceId = await findPersonalWorkspaceFolderIdForUser(user.id);
      if (!workspaceId) {
        const res = errorResponse(
          "WORKSPACE_MISSING",
          "My Workspace가 없습니다. 관리자에게 문의하세요",
          500,
        );
        return NextResponse.json(res.body, { status: res.status });
      }
      targetFolderId = workspaceId;
    }

    const tagsJson = JSON.stringify(
      Array.isArray(tags) ? tags.map((t: string) => t.trim()) : [],
    );

    const created = await createInstruction({
      title: title.trim(),
      content: (content ?? "").trim(),
      agentType: (agent_type ?? "general").trim(),
      tagsJson,
      priority: typeof priority === "number" ? priority : 0,
      ownerId: user.id,
      folderId: targetFolderId,
      credentialId: typeof credential_id === "number" ? credential_id : null,
    });

    const res = okResponse(created, 201);
    return NextResponse.json(res.body, { status: res.status });
  },
);
