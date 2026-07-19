import { NextRequest, NextResponse } from "next/server";
import { DesignSystem, errorResponse, okResponse } from "@/lib/db";
import {
  canEditDesignSystem,
  canEditFolder,
  loadFolder,
} from "@/lib/authorization";
import { loadResourceOrFail } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";
import {
  addDesignSystemAsset,
  createDesignSystem,
  createDesignSystemVersion,
  findPersonalDesignSystemWorkspaceFolderId,
  getDesignSystemDetail,
  parseDesignSystemPackageExport,
  recordDesignSystemEvent,
} from "@/lib/db/repositories/design-systems";

export const POST = withAuth(
  "design_systems:create",
  async (request: NextRequest, user) => {
    const body = await request.json();
    const mode =
      body.mode === "version" ||
      typeof body.target_design_system_id === "number"
        ? "version"
        : "create";

    let parsed;
    try {
      parsed = parseDesignSystemPackageExport(body.package ?? body);
    } catch (error) {
      const res = errorResponse(
        "VALIDATION_ERROR",
        error instanceof Error
          ? error.message
          : "디자인시스템 패키지를 해석할 수 없습니다",
        400,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    try {
      let created;
      if (mode === "version") {
        if (typeof body.target_design_system_id !== "number") {
          const res = errorResponse(
            "VALIDATION_ERROR",
            "target_design_system_id is required for version imports",
            400,
          );
          return NextResponse.json(res.body, { status: res.status });
        }

        const { response: errResp } = await loadResourceOrFail<DesignSystem>({
          table: "design_systems",
          id: body.target_design_system_id,
          user,
          check: canEditDesignSystem,
          notFoundMessage: "디자인시스템을 찾을 수 없습니다",
          forbiddenMessage: "편집 권한 없음",
        });
        if (errResp) return errResp;

        const source = await getDesignSystemDetail(
          body.target_design_system_id,
        );
        if (!source) {
          const res = errorResponse(
            "NOT_FOUND",
            "디자인시스템을 찾을 수 없습니다",
            404,
          );
          return NextResponse.json(res.body, { status: res.status });
        }

        created = await createDesignSystemVersion({
          source,
          title: typeof body.title === "string" ? body.title : parsed.title,
          description:
            typeof body.description === "string"
              ? body.description
              : parsed.description,
          version:
            typeof body.version === "string" ? body.version : parsed.version,
          schema: parsed.schema,
          tokens: parsed.tokens,
          colorTokens: parsed.colorTokens,
          typographyTokens: parsed.typographyTokens,
          componentTokens: parsed.componentTokens,
          guidelinesMarkdown: parsed.guidelinesMarkdown,
          skillMarkdown: parsed.skillMarkdown,
          exportManifest: parsed.exportManifest,
          copyAssets: false,
        });
      } else {
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

        created = await createDesignSystem({
          title: typeof body.title === "string" ? body.title : parsed.title,
          slug: typeof body.slug === "string" ? body.slug : parsed.slug,
          description:
            typeof body.description === "string"
              ? body.description
              : parsed.description,
          version:
            typeof body.version === "string" ? body.version : parsed.version,
          category:
            typeof body.category === "string" ? body.category : parsed.category,
          surface:
            typeof body.surface === "string" ? body.surface : parsed.surface,
          status: body.status,
          schema: parsed.schema,
          tokens: parsed.tokens,
          colorTokens: parsed.colorTokens,
          typographyTokens: parsed.typographyTokens,
          componentTokens: parsed.componentTokens,
          guidelinesMarkdown: parsed.guidelinesMarkdown,
          skillMarkdown: parsed.skillMarkdown,
          exportManifest: parsed.exportManifest,
          ownerId: user.id,
          folderId: targetFolderId,
        });
      }

      const importedAssets = [];
      for (const asset of parsed.assets) {
        importedAssets.push(
          await addDesignSystemAsset({
            designSystemId: created.id,
            kind: asset.kind,
            filename: asset.filename,
            mimeType: asset.mimeType,
            contentText: asset.contentText,
          }),
        );
      }

      await recordDesignSystemEvent({
        designSystemId: created.id,
        actorUserId: user.id,
        action: "import_package",
        summary:
          mode === "version"
            ? `Imported package as version ${created.version}`
            : "Imported design-system package",
        metadata: {
          mode,
          title: created.title,
          slug: created.slug,
          version: created.version,
          imported_assets: importedAssets.length,
        },
      });

      const res = okResponse(
        {
          mode,
          design_system: created,
          imported_assets: importedAssets,
        },
        201,
      );
      return NextResponse.json(res.body, { status: res.status });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const code = message.includes("already exists")
        ? "CONFLICT"
        : "VALIDATION_ERROR";
      const res = errorResponse(code, message, code === "CONFLICT" ? 409 : 400);
      return NextResponse.json(res.body, { status: res.status });
    }
  },
);
