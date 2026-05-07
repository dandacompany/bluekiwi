import { NextRequest, NextResponse } from "next/server";
import { DesignSystem, errorResponse, okResponse } from "@/lib/db";
import {
  canEditDesignSystem,
  canReadDesignSystem,
} from "@/lib/authorization";
import { loadResourceOrFail } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";
import {
  deleteDesignSystemSectionEntry,
  getDesignSystemDetail,
  getDesignSystemSectionEntryValue,
  normalizeDesignSystemSection,
  recordDesignSystemEvent,
  upsertDesignSystemSectionEntry,
} from "@/lib/db/repositories/design-systems";
import { parseDesignSystemId } from "../../../../route-helpers";

type Params = { params: Promise<{ id: string; section: string; key: string }> };

function validationError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  const res = errorResponse("VALIDATION_ERROR", message, 400);
  return NextResponse.json(res.body, { status: res.status });
}

function notFound(key: string) {
  const res = errorResponse(
    "NOT_FOUND",
    `디자인시스템 섹션 항목을 찾을 수 없습니다: ${key}`,
    404,
  );
  return NextResponse.json(res.body, { status: res.status });
}

async function parseEntryBody(request: NextRequest): Promise<unknown> {
  const body = await request.json();
  const isObject = !!body && typeof body === "object" && !Array.isArray(body);
  return isObject && "value" in body ? body.value : body;
}

export const GET = withAuth<Params>(
  "design_systems:read",
  async (_request, user, { params }) => {
    const { id, section, key } = await params;
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
      const value = getDesignSystemSectionEntryValue(
        detail,
        normalizedSection,
        key,
      );
      if (value === null) return notFound(key);
      const res = okResponse({ section: normalizedSection, key, value });
      return NextResponse.json(res.body, { status: res.status });
    } catch (error) {
      return validationError(error);
    }
  },
);

export const PATCH = withAuth<Params>(
  "design_systems:update",
  async (request, user, { params }) => {
    const { id, section, key } = await params;
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
      const value = await parseEntryBody(request);
      const updated = await upsertDesignSystemSectionEntry({
        id: designSystemId,
        section,
        key,
        value,
      });
      const normalizedSection = normalizeDesignSystemSection(section);
      await recordDesignSystemEvent({
        designSystemId,
        actorUserId: user.id,
        action: "upsert_section_entry",
        summary: `Updated ${normalizedSection}.${key}`,
        metadata: { section: normalizedSection, key },
      });
      const res = okResponse({
        section: normalizedSection,
        key,
        value: getDesignSystemSectionEntryValue(updated, normalizedSection, key),
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
    const { id, section, key } = await params;
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
      const updated = await deleteDesignSystemSectionEntry({
        id: designSystemId,
        section,
        key,
      });
      const normalizedSection = normalizeDesignSystemSection(section);
      await recordDesignSystemEvent({
        designSystemId,
        actorUserId: user.id,
        action: "delete_section_entry",
        summary: `Deleted ${normalizedSection}.${key}`,
        metadata: { section: normalizedSection, key },
      });
      const res = okResponse({
        section: normalizedSection,
        key,
        deleted: true,
        design_system: updated,
      });
      return NextResponse.json(res.body, { status: res.status });
    } catch (error) {
      return validationError(error);
    }
  },
);
