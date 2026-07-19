import { NextRequest, NextResponse } from "next/server";
import { DesignSystem, errorResponse, okResponse } from "@/lib/db";
import { canEditDesignSystem, canReadDesignSystem } from "@/lib/authorization";
import { loadResourceOrFail } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";
import {
  createDesignSystemVersion,
  getDesignSystemDetail,
  listDesignSystemFamilyVersions,
  recordDesignSystemEvent,
} from "@/lib/db/repositories/design-systems";
import { parseDesignSystemId } from "../../route-helpers";

type Params = { params: Promise<{ id: string }> };

export const GET = withAuth<Params>(
  "design_systems:read",
  async (_request: NextRequest, user, { params }) => {
    const { id } = await params;
    const parsedId = parseDesignSystemId(id);
    if (parsedId instanceof NextResponse) return parsedId;
    const designSystemId = parsedId;

    const { resource, response: errResp } =
      await loadResourceOrFail<DesignSystem>({
        table: "design_systems",
        id: designSystemId,
        user,
        check: canReadDesignSystem,
        notFoundMessage: "디자인시스템을 찾을 수 없습니다",
        forbiddenMessage: "접근 권한 없음",
      });
    if (errResp) return errResp;

    const versions = await listDesignSystemFamilyVersions(resource.id);
    const activeVersion = versions.find((version) => version.is_active);
    const res = okResponse({
      family_root_id: resource.family_root_id ?? resource.id,
      active_version_id: activeVersion?.id ?? null,
      versions,
    });
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const POST = withAuth<Params>(
  "design_systems:update",
  async (request: NextRequest, user, { params }) => {
    const { id } = await params;
    const parsedId = parseDesignSystemId(id);
    if (parsedId instanceof NextResponse) return parsedId;
    const designSystemId = parsedId;
    const body = await request.json();

    const { response: errResp } = await loadResourceOrFail<DesignSystem>({
      table: "design_systems",
      id: designSystemId,
      user,
      check: canEditDesignSystem,
      notFoundMessage: "디자인시스템을 찾을 수 없습니다",
      forbiddenMessage: "편집 권한 없음",
    });
    if (errResp) return errResp;

    const source = await getDesignSystemDetail(designSystemId);
    if (!source) {
      const res = errorResponse(
        "NOT_FOUND",
        "디자인시스템을 찾을 수 없습니다",
        404,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    try {
      const created = await createDesignSystemVersion({
        source,
        title: typeof body.title === "string" ? body.title : undefined,
        description:
          typeof body.description === "string" ? body.description : undefined,
        version: typeof body.version === "string" ? body.version : undefined,
        schema: body.schema,
        tokens: body.tokens,
        colorTokens: body.color_tokens,
        typographyTokens: body.typography_tokens,
        componentTokens: body.component_tokens,
        guidelinesMarkdown:
          typeof body.guidelines_markdown === "string"
            ? body.guidelines_markdown
            : undefined,
        skillMarkdown:
          typeof body.skill_markdown === "string"
            ? body.skill_markdown
            : undefined,
        exportManifest: body.export_manifest,
        copyAssets: body.copy_assets !== false,
      });
      await recordDesignSystemEvent({
        designSystemId: created.id,
        actorUserId: user.id,
        action: "create_version",
        summary: `Created version ${created.version}`,
        metadata: {
          source_design_system_id: source.id,
          source_version: source.version,
          version: created.version,
          copied_assets: body.copy_assets !== false,
        },
      });

      const res = okResponse(created, 201);
      return NextResponse.json(res.body, { status: res.status });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const res = errorResponse("VALIDATION_ERROR", message, 400);
      return NextResponse.json(res.body, { status: res.status });
    }
  },
);
