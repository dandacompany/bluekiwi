import { NextRequest, NextResponse } from "next/server";

import { errorResponse, okResponse } from "@/lib/db";
import { seedBuiltinDesignSystems } from "@/lib/seed-design-systems";
import { withAuth } from "@/lib/with-auth";
import { findPersonalDesignSystemWorkspaceFolderId } from "@/lib/db/repositories/design-systems";

export const POST = withAuth(
  "design_systems:create",
  async (_request: NextRequest, user) => {
    const workspaceId = await findPersonalDesignSystemWorkspaceFolderId(
      user.id,
    );
    if (!workspaceId) {
      const res = errorResponse(
        "WORKSPACE_MISSING",
        "My Workspace가 없습니다. 관리자에게 문의하세요",
        500,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    const seeded = await seedBuiltinDesignSystems(user.id, workspaceId);
    const res = okResponse({ seeded });
    return NextResponse.json(res.body, { status: res.status });
  },
);
