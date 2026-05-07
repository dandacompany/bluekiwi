import { NextRequest, NextResponse } from "next/server";
import { DesignSystem, errorResponse, okResponse } from "@/lib/db";
import {
  canEditDesignSystem,
  canReadDesignSystem,
} from "@/lib/authorization";
import { loadResourceOrFail, withResource } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";
import {
  deleteDesignSystem,
  getDesignSystemDetail,
  recordDesignSystemEvent,
  updateDesignSystem,
} from "@/lib/db/repositories/design-systems";
import { parseDesignSystemId } from "../route-helpers";

type Params = { params: Promise<{ id: string }> };

function errorFromException(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  const code = message.includes("already exists")
    ? "CONFLICT"
    : "VALIDATION_ERROR";
  const status = code === "CONFLICT" ? 409 : 400;
  return errorResponse(code, message, status);
}

export const GET = withResource<DesignSystem>({
  permission: "design_systems:read",
  table: "design_systems",
  check: canReadDesignSystem,
  notFoundMessage: "디자인시스템을 찾을 수 없습니다",
  forbiddenMessage: "접근 권한 없음",
  handler: async ({ resource }) => {
    const detail = await getDesignSystemDetail(resource.id);
    if (!detail) {
      const res = errorResponse(
        "NOT_FOUND",
        "디자인시스템을 찾을 수 없습니다",
        404,
      );
      return NextResponse.json(res.body, { status: res.status });
    }
    const res = okResponse(detail);
    return NextResponse.json(res.body, { status: res.status });
  },
});

export const PATCH = withAuth<Params>(
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

    try {
      const updated = await updateDesignSystem({
        id: designSystemId,
        title: typeof body.title === "string" ? body.title : undefined,
        slug: typeof body.slug === "string" ? body.slug : undefined,
        description:
          typeof body.description === "string" ? body.description : undefined,
        category: typeof body.category === "string" ? body.category : undefined,
        surface: typeof body.surface === "string" ? body.surface : undefined,
        status: body.status,
        visibilityOverride:
          "visibility_override" in body ? body.visibility_override : undefined,
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
      });
      await recordDesignSystemEvent({
        designSystemId: updated.id,
        actorUserId: user.id,
        action: "update",
        summary: "Updated design system",
        metadata: {
          fields: Object.keys(body ?? {}).sort(),
          version: updated.version,
        },
      });

      const res = okResponse(updated);
      return NextResponse.json(res.body, { status: res.status });
    } catch (error) {
      const res = errorFromException(error);
      return NextResponse.json(res.body, { status: res.status });
    }
  },
);

export const DELETE = withAuth<Params>(
  "design_systems:update",
  async (request: NextRequest, user, { params }) => {
    const { id } = await params;
    const parsedId = parseDesignSystemId(id);
    if (parsedId instanceof NextResponse) return parsedId;
    const designSystemId = parsedId;

    const { response: errResp } = await loadResourceOrFail<DesignSystem>({
      table: "design_systems",
      id: designSystemId,
      user,
      check: canEditDesignSystem,
      notFoundMessage: "디자인시스템을 찾을 수 없습니다",
      forbiddenMessage: "편집 권한 없음",
    });
    if (errResp) return errResp;

    try {
      const url = new URL(request.url);
      const family = url.searchParams.get("family") === "true";
      await deleteDesignSystem({ id: designSystemId, family });
      const res = okResponse({ id: designSystemId, family, deleted: true });
      return NextResponse.json(res.body, { status: res.status });
    } catch (error) {
      const res = errorFromException(error);
      return NextResponse.json(res.body, { status: res.status });
    }
  },
);
