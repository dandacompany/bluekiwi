import { NextRequest, NextResponse } from "next/server";
import { DesignSystem, errorResponse, okResponse } from "@/lib/db";
import { canEditDesignSystem, canReadDesignSystem } from "@/lib/authorization";
import { loadResourceOrFail } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";
import {
  deleteDesignSystemComponent,
  getDesignSystemComponentValue,
  getDesignSystemDetail,
  recordDesignSystemEvent,
  upsertDesignSystemComponent,
} from "@/lib/db/repositories/design-systems";
import { parseDesignSystemId } from "../../../route-helpers";

type Params = { params: Promise<{ id: string; name: string }> };

function validationError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  const res = errorResponse("VALIDATION_ERROR", message, 400);
  return NextResponse.json(res.body, { status: res.status });
}

function componentNotFound(name: string) {
  const res = errorResponse(
    "NOT_FOUND",
    `디자인시스템 컴포넌트를 찾을 수 없습니다: ${name}`,
    404,
  );
  return NextResponse.json(res.body, { status: res.status });
}

async function parseComponentBody(request: NextRequest): Promise<unknown> {
  const body = await request.json();
  const isObject = !!body && typeof body === "object" && !Array.isArray(body);
  return isObject && "value" in body ? body.value : body;
}

export const GET = withAuth<Params>(
  "design_systems:read",
  async (_request, user, { params }) => {
    const { id, name } = await params;
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

    const detail = await getDesignSystemDetail(designSystemId);
    if (!detail) {
      const res = errorResponse(
        "NOT_FOUND",
        "디자인시스템을 찾을 수 없습니다",
        404,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    const component = getDesignSystemComponentValue(detail, name);
    if (!component) return componentNotFound(name);
    const res = okResponse(component);
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const PATCH = withAuth<Params>(
  "design_systems:update",
  async (request, user, { params }) => {
    const { id, name } = await params;
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
      const value = await parseComponentBody(request);
      const updated = await upsertDesignSystemComponent({
        id: designSystemId,
        name,
        value,
      });
      const component = getDesignSystemComponentValue(updated, name);
      await recordDesignSystemEvent({
        designSystemId,
        actorUserId: user.id,
        action: "upsert_component",
        summary: `Updated component ${name}`,
        metadata: { component: name },
      });
      const res = okResponse({ component, design_system: updated });
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
    const { id, name } = await params;
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
      const updated = await deleteDesignSystemComponent({
        id: designSystemId,
        name,
      });
      await recordDesignSystemEvent({
        designSystemId,
        actorUserId: user.id,
        action: "delete_component",
        summary: `Deleted component ${name}`,
        metadata: { component: name },
      });
      const res = okResponse({ name, deleted: true, design_system: updated });
      return NextResponse.json(res.body, { status: res.status });
    } catch (error) {
      return validationError(error);
    }
  },
);
