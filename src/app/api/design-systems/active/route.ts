import { NextRequest, NextResponse } from "next/server";

import { DesignSystem, errorResponse, okResponse } from "@/lib/db";
import { canReadDesignSystem } from "@/lib/authorization";
import { loadResourceOrFail } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";
import {
  getDesignSystemDetail,
  findDesignSystemById,
} from "@/lib/db/repositories/design-systems";
import {
  deleteUserSetting,
  getUserSetting,
  setUserSetting,
} from "@/lib/db/repositories/user-settings";

const ACTIVE_DESIGN_SYSTEM_KEY = "active_design_system_id";

export const GET = withAuth(
  "design_systems:read",
  async (_request: NextRequest, user) => {
    const rawId = await getUserSetting(user.id, ACTIVE_DESIGN_SYSTEM_KEY);
    const designSystemId = rawId ? Number(rawId) : NaN;
    if (!Number.isInteger(designSystemId)) {
      const res = okResponse({ active: null });
      return NextResponse.json(res.body, { status: res.status });
    }

    const designSystem = await findDesignSystemById(designSystemId);
    if (!designSystem || !(await canReadDesignSystem(user, designSystem))) {
      await deleteUserSetting(user.id, ACTIVE_DESIGN_SYSTEM_KEY);
      const res = okResponse({ active: null });
      return NextResponse.json(res.body, { status: res.status });
    }

    const detail = await getDesignSystemDetail(designSystemId);
    const res = okResponse({ active: detail });
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const PUT = withAuth(
  "design_systems:read",
  async (request: NextRequest, user) => {
    const body = await request.json();
    const designSystemId = Number(body.design_system_id);
    if (!Number.isInteger(designSystemId)) {
      const res = errorResponse(
        "VALIDATION_ERROR",
        "design_system_id must be a number",
        400,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

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

    await setUserSetting(
      user.id,
      ACTIVE_DESIGN_SYSTEM_KEY,
      String(resource.id),
    );
    const detail = await getDesignSystemDetail(resource.id);
    const res = okResponse({ active: detail });
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const DELETE = withAuth(
  "design_systems:read",
  async (_request: NextRequest, user) => {
    await deleteUserSetting(user.id, ACTIVE_DESIGN_SYSTEM_KEY);
    const res = okResponse({ active: null });
    return NextResponse.json(res.body, { status: res.status });
  },
);
