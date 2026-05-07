import { NextRequest, NextResponse } from "next/server";
import { DesignSystem, errorResponse, okResponse } from "@/lib/db";
import {
  canEditDesignSystem,
  canReadDesignSystem,
} from "@/lib/authorization";
import { loadResourceOrFail } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";
import {
  clearDesignSystemSection,
  getDesignSystemDetail,
  getDesignSystemSectionValue,
  normalizeDesignSystemSection,
  updateDesignSystemSection,
} from "@/lib/db/repositories/design-systems";
import { parseDesignSystemId } from "../../../route-helpers";

type Params = { params: Promise<{ id: string; section: string }> };

function validationError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  const res = errorResponse("VALIDATION_ERROR", message, 400);
  return NextResponse.json(res.body, { status: res.status });
}

async function parseSectionBody(request: NextRequest): Promise<{
  value: unknown;
  mode: unknown;
}> {
  const body = await request.json();
  const isObject = !!body && typeof body === "object" && !Array.isArray(body);
  return {
    value: isObject && "value" in body ? body.value : body,
    mode: isObject && "mode" in body ? body.mode : undefined,
  };
}

export const GET = withAuth<Params>(
  "design_systems:read",
  async (_request, user, { params }) => {
    const { id, section } = await params;
    const parsedId = parseDesignSystemId(id);
    if (parsedId instanceof NextResponse) return parsedId;
    const designSystemId = parsedId;

    const { response: errResp } = await loadResourceOrFail<DesignSystem>({
      table: "design_systems",
      id: designSystemId,
      user,
      check: canReadDesignSystem,
      notFoundMessage: "디자인시스템을 찾을 수 없습니다",
      forbiddenMessage: "접근 권한 없음",
    });
    if (errResp) return errResp;

    try {
      const normalizedSection = normalizeDesignSystemSection(section);
      const detail = await getDesignSystemDetail(designSystemId);
      if (!detail) {
        const res = errorResponse(
          "NOT_FOUND",
          "디자인시스템을 찾을 수 없습니다",
          404,
        );
        return NextResponse.json(res.body, { status: res.status });
      }
      const res = okResponse({
        section: normalizedSection,
        value: getDesignSystemSectionValue(detail, normalizedSection),
      });
      return NextResponse.json(res.body, { status: res.status });
    } catch (error) {
      return validationError(error);
    }
  },
);

export const PATCH = withAuth<Params>(
  "design_systems:update",
  async (request, user, { params }) => {
    const { id, section } = await params;
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
      const body = await parseSectionBody(request);
      const updated = await updateDesignSystemSection({
        id: designSystemId,
        section,
        value: body.value,
        mode: body.mode,
      });
      const normalizedSection = normalizeDesignSystemSection(section);
      const res = okResponse({
        section: normalizedSection,
        value: getDesignSystemSectionValue(updated, normalizedSection),
        design_system: updated,
      });
      return NextResponse.json(res.body, { status: res.status });
    } catch (error) {
      return validationError(error);
    }
  },
);

export const PUT = PATCH;

export const DELETE = withAuth<Params>(
  "design_systems:update",
  async (_request, user, { params }) => {
    const { id, section } = await params;
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
      const updated = await clearDesignSystemSection({
        id: designSystemId,
        section,
      });
      const normalizedSection = normalizeDesignSystemSection(section);
      const res = okResponse({
        section: normalizedSection,
        value: getDesignSystemSectionValue(updated, normalizedSection),
        cleared: true,
        design_system: updated,
      });
      return NextResponse.json(res.body, { status: res.status });
    } catch (error) {
      return validationError(error);
    }
  },
);
