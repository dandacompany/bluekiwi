import { NextRequest, NextResponse } from "next/server";
import { errorResponse, okResponse } from "@/lib/db";
import { buildDesignSystemVisibilityFilter } from "@/lib/authorization";
import { withAuth } from "@/lib/with-auth";
import {
  analyzeDesignSystemPackage,
  listDesignSystemsForVisibilityFilter,
} from "@/lib/db/repositories/design-systems";

export const POST = withAuth(
  "design_systems:read",
  async (request: NextRequest, user) => {
    const body = await request.json();
    const rawPackage = body.package ?? body;

    let initialAnalysis;
    try {
      initialAnalysis = analyzeDesignSystemPackage(rawPackage);
    } catch (error) {
      const res = errorResponse(
        "VALIDATION_ERROR",
        error instanceof Error
          ? error.message
          : "디자인시스템 패키지를 해석할 수 없습니다",
        400,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    const filter = await buildDesignSystemVisibilityFilter("ds", user, 1);
    const candidates = await listDesignSystemsForVisibilityFilter({
      filterSql: filter.sql,
      filterParams: filter.params,
      includeInactive: true,
      q: initialAnalysis.summary.slug ?? initialAnalysis.summary.title,
    });
    const analysis = analyzeDesignSystemPackage(rawPackage, candidates);
    const res = okResponse(analysis);
    return NextResponse.json(res.body, { status: res.status });
  },
);
