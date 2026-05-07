import { NextResponse } from "next/server";
import { DesignSystem, errorResponse, okResponse } from "@/lib/db";
import { canReadDesignSystem } from "@/lib/authorization";
import { withResource } from "@/lib/api-helpers";
import {
  buildDesignSystemJsonExport,
  buildDesignSystemSkillExport,
  getDesignSystemDetail,
} from "@/lib/db/repositories/design-systems";

export const GET = withResource<DesignSystem>({
  permission: "design_systems:read",
  table: "design_systems",
  check: canReadDesignSystem,
  notFoundMessage: "디자인시스템을 찾을 수 없습니다",
  forbiddenMessage: "접근 권한 없음",
  handler: async ({ resource, request }) => {
    const url = new URL(request.url);
    const format = url.searchParams.get("format") ?? "json";
    const detail = await getDesignSystemDetail(resource.id);
    if (!detail) {
      const res = errorResponse(
        "NOT_FOUND",
        "디자인시스템을 찾을 수 없습니다",
        404,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    if (format === "json") {
      const res = okResponse(buildDesignSystemJsonExport(detail));
      return NextResponse.json(res.body, { status: res.status });
    }
    if (format === "skill") {
      const res = okResponse({
        format: "skill",
        filename: "SKILL.md",
        content: buildDesignSystemSkillExport(detail),
      });
      return NextResponse.json(res.body, { status: res.status });
    }

    const res = errorResponse(
      "UNSUPPORTED_FORMAT",
      "format must be json or skill",
      400,
    );
    return NextResponse.json(res.body, { status: res.status });
  },
});
