import { NextRequest, NextResponse } from "next/server";
import { errorResponse, listResponse, okResponse } from "@/lib/db";
import {
  buildDesignSystemVisibilityFilter,
  canEditFolder,
  loadFolder,
} from "@/lib/authorization";
import { withAuth } from "@/lib/with-auth";
import {
  createDesignSystem,
  findPersonalDesignSystemWorkspaceFolderId,
  listDesignSystemsForVisibilityFilter,
} from "@/lib/db/repositories/design-systems";

function errorFromException(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  const code = message.includes("already exists")
    ? "CONFLICT"
    : "VALIDATION_ERROR";
  const status = code === "CONFLICT" ? 409 : 400;
  return errorResponse(code, message, status);
}

export const GET = withAuth(
  "design_systems:read",
  async (request: NextRequest, user) => {
    const url = new URL(request.url);
    const includeInactive = url.searchParams.get("include_inactive") === "true";
    const folderId = url.searchParams.get("folder_id");
    const q = url.searchParams.get("q");

    const filter = await buildDesignSystemVisibilityFilter("ds", user, 1);
    const rows = await listDesignSystemsForVisibilityFilter({
      filterSql: filter.sql,
      filterParams: filter.params,
      includeInactive,
      folderId: folderId ? Number(folderId) : undefined,
      q: q ?? undefined,
    });

    const res = listResponse(rows, rows.length);
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const POST = withAuth(
  "design_systems:create",
  async (request: NextRequest, user) => {
    const body = await request.json();

    let targetFolderId: number;
    if (typeof body.folder_id === "number") {
      const folder = await loadFolder(body.folder_id);
      if (!folder) {
        const res = errorResponse("NOT_FOUND", "folder not found", 404);
        return NextResponse.json(res.body, { status: res.status });
      }
      if (!(await canEditFolder(user, folder))) {
        const res = errorResponse(
          "OWNERSHIP_REQUIRED",
          "폴더 편집 권한 없음",
          403,
        );
        return NextResponse.json(res.body, { status: res.status });
      }
      targetFolderId = folder.id;
    } else {
      const workspaceId = await findPersonalDesignSystemWorkspaceFolderId(
        user.id,
      );
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

    try {
      const created = await createDesignSystem({
        title: String(body.title ?? ""),
        slug: typeof body.slug === "string" ? body.slug : undefined,
        description:
          typeof body.description === "string" ? body.description : "",
        version: typeof body.version === "string" ? body.version : undefined,
        status: body.status,
        schema: body.schema,
        tokens: body.tokens,
        colorTokens: body.color_tokens,
        typographyTokens: body.typography_tokens,
        componentTokens: body.component_tokens,
        guidelinesMarkdown:
          typeof body.guidelines_markdown === "string"
            ? body.guidelines_markdown
            : "",
        skillMarkdown:
          typeof body.skill_markdown === "string" ? body.skill_markdown : "",
        exportManifest: body.export_manifest,
        ownerId: user.id,
        folderId: targetFolderId,
      });

      const res = okResponse(created, 201);
      return NextResponse.json(res.body, { status: res.status });
    } catch (error) {
      const res = errorFromException(error);
      return NextResponse.json(res.body, { status: res.status });
    }
  },
);
