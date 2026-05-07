import { NextResponse } from "next/server";
import { DesignSystem, errorResponse } from "@/lib/db";
import { canReadDesignSystem } from "@/lib/authorization";
import { withResource } from "@/lib/api-helpers";
import {
  buildDesignSystemPreviewHtml,
  getDesignSystemDetail,
} from "@/lib/db/repositories/design-systems";

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

    return new NextResponse(buildDesignSystemPreviewHtml(detail), {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  },
});
