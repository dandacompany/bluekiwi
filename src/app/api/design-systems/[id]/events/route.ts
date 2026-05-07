import { NextRequest, NextResponse } from "next/server";

import { DesignSystem, errorResponse, listResponse } from "@/lib/db";
import { canReadDesignSystem } from "@/lib/authorization";
import { loadResourceOrFail } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";
import { listDesignSystemEvents } from "@/lib/db/repositories/design-systems";
import { parseDesignSystemId } from "../../route-helpers";

type Params = { params: Promise<{ id: string }> };

export const GET = withAuth<Params>(
  "design_systems:read",
  async (request: NextRequest, user, { params }) => {
    const { id } = await params;
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

    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? "50");
    if (!Number.isFinite(limit)) {
      const res = errorResponse("VALIDATION_ERROR", "limit must be a number", 400);
      return NextResponse.json(res.body, { status: res.status });
    }

    const events = await listDesignSystemEvents({
      designSystemId,
      limit,
    });
    const res = listResponse(events, events.length);
    return NextResponse.json(res.body, { status: res.status });
  },
);
