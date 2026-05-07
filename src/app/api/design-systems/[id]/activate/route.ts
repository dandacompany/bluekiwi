import { NextRequest, NextResponse } from "next/server";

import { DesignSystem, errorResponse, okResponse } from "@/lib/db";
import { canEditDesignSystem } from "@/lib/authorization";
import { loadResourceOrFail } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";
import {
  activateDesignSystemVersion,
  getDesignSystemDetail,
} from "@/lib/db/repositories/design-systems";
import { parseDesignSystemId } from "../../route-helpers";

type Params = { params: Promise<{ id: string }> };

export const POST = withAuth<Params>(
  "design_systems:update",
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
        check: canEditDesignSystem,
        notFoundMessage: "디자인시스템을 찾을 수 없습니다",
        forbiddenMessage: "편집 권한 없음",
      });
    if (errResp) return errResp;

    if (resource.is_active) {
      const detail = await getDesignSystemDetail(resource.id);
      const res = okResponse({
        id: resource.id,
        family_root_id: resource.family_root_id,
        is_active: true,
        already_active: true,
        design_system: detail,
      });
      return NextResponse.json(res.body, { status: res.status });
    }

    try {
      const activated = await activateDesignSystemVersion(resource);
      const detail = await getDesignSystemDetail(activated.id);
      const res = okResponse({
        id: activated.id,
        family_root_id: activated.family_root_id,
        is_active: activated.is_active,
        already_active: false,
        design_system: detail,
      });
      return NextResponse.json(res.body, { status: res.status });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const res = errorResponse("VALIDATION_ERROR", message, 400);
      return NextResponse.json(res.body, { status: res.status });
    }
  },
);
