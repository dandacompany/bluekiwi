import { NextRequest, NextResponse } from "next/server";

import { DesignSystem, errorResponse, okResponse } from "@/lib/db";
import { canReadDesignSystem } from "@/lib/authorization";
import { loadResourceOrFail } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";
import {
  buildDesignSystemVersionDiff,
  getDesignSystemDetail,
} from "@/lib/db/repositories/design-systems";
import { parseDesignSystemId } from "../../../route-helpers";

type Params = { params: Promise<{ id: string }> };

function parseVersionId(
  value: string | null,
  name: string,
): number | NextResponse {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    const res = errorResponse(
      "VALIDATION_ERROR",
      `${name} must be a positive integer design-system id`,
      400,
    );
    return NextResponse.json(res.body, { status: res.status });
  }
  return id;
}

export const GET = withAuth<Params>(
  "design_systems:read",
  async (request: NextRequest, user, { params }) => {
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

    const url = new URL(request.url);
    const fromId = parseVersionId(url.searchParams.get("from"), "from");
    if (fromId instanceof NextResponse) return fromId;
    const toId = parseVersionId(url.searchParams.get("to"), "to");
    if (toId instanceof NextResponse) return toId;

    const [from, to] = await Promise.all([
      getDesignSystemDetail(fromId),
      getDesignSystemDetail(toId),
    ]);

    if (!from || !to) {
      const res = errorResponse(
        "NOT_FOUND",
        "비교할 디자인시스템 버전을 찾을 수 없습니다",
        404,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    const familyRootId = resource.family_root_id ?? resource.id;
    if (
      (from.family_root_id ?? from.id) !== familyRootId ||
      (to.family_root_id ?? to.id) !== familyRootId
    ) {
      const res = errorResponse(
        "VALIDATION_ERROR",
        "from and to must belong to the selected design-system family",
        400,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    const res = okResponse(buildDesignSystemVersionDiff(from, to));
    return NextResponse.json(res.body, { status: res.status });
  },
);
