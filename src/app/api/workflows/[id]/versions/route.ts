import { NextRequest, NextResponse } from "next/server";
import { query, queryOne, Workflow, okResponse, errorResponse } from "@/lib/db";
import { withOptionalAuth } from "@/lib/with-auth";

type Params = { params: Promise<{ id: string }> };

interface VersionRow {
  id: number;
  title: string;
  version: string;
  is_active: boolean;
  parent_workflow_id: number | null;
  family_root_id: number;
  created_at: string;
  updated_at: string;
}

export const GET = withOptionalAuth<Params>(
  "workflows:read",
  async (_request: NextRequest, _user, { params }: Params) => {
    const { id } = await params;
    const workflowId = Number(id);

    const workflow = await queryOne<Workflow>(
      "SELECT id, family_root_id FROM workflows WHERE id = $1",
      [workflowId],
    );
    if (!workflow) {
      const res = errorResponse(
        "NOT_FOUND",
        "워크플로를 찾을 수 없습니다",
        404,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    const versions = await query<VersionRow>(
      `SELECT id, title, version, is_active, parent_workflow_id, family_root_id,
              created_at, updated_at
         FROM workflows
        WHERE family_root_id = $1
        ORDER BY created_at ASC`,
      [workflow.family_root_id],
    );

    const activeVersion = versions.find((v) => v.is_active) ?? null;

    const res = okResponse({
      family_root_id: workflow.family_root_id,
      active_version_id: activeVersion?.id ?? null,
      versions,
    });
    return NextResponse.json(res.body, { status: res.status });
  },
);
