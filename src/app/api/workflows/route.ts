import { NextRequest, NextResponse } from "next/server";
import { Workflow, okResponse, listResponse, errorResponse } from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import {
  buildResourceVisibilityFilter,
  canEditFolder,
  loadFolder,
} from "@/lib/authorization";
import {
  createWorkflowWithNodes,
  findPersonalWorkflowWorkspaceFolderId,
  listWorkflowsForVisibilityFilter,
} from "@/lib/db/repositories/workflows";

export const GET = withAuth(
  "workflows:read",
  async (request: NextRequest, user) => {
    const url = new URL(request.url);
    const includeInactive = url.searchParams.get("include_inactive") === "true";
    const slim = url.searchParams.get("slim") !== "false"; // default true
    const folderId = url.searchParams.get("folder_id");
    const q = url.searchParams.get("q");

    const filter = await buildResourceVisibilityFilter("w", user, 1);

    const workflows = await listWorkflowsForVisibilityFilter({
      filterSql: filter.sql,
      filterParams: filter.params,
      includeInactive,
      folderId: folderId ? Number(folderId) : undefined,
      q: q ?? undefined,
      slim,
    });

    const res = listResponse(workflows, workflows.length);
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const POST = withAuth(
  "workflows:create",
  async (request: NextRequest, user) => {
    const body = await request.json();
    const {
      title,
      description,
      nodes,
      version,
      parent_workflow_id,
      evaluation_contract,
    } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      const res = errorResponse("VALIDATION_ERROR", "title is required", 400);
      return NextResponse.json(res.body, { status: res.status });
    }

    const versionValue =
      typeof version === "string" && version.trim() ? version.trim() : "1.0";
    const parentWorkflowIdValue =
      typeof parent_workflow_id === "number" ? parent_workflow_id : null;
    const evaluationContractValue =
      evaluation_contract === undefined || evaluation_contract === null
        ? null
        : typeof evaluation_contract === "string"
          ? evaluation_contract
          : JSON.stringify(evaluation_contract);

    // Resolve target folder: user-provided or default to My Workspace
    let targetFolderId: number;
    if (typeof body.folder_id === "number") {
      const f = await loadFolder(body.folder_id);
      if (!f) {
        const res = errorResponse("NOT_FOUND", "folder not found", 404);
        return NextResponse.json(res.body, { status: res.status });
      }
      if (!(await canEditFolder(user, f))) {
        const res = errorResponse(
          "OWNERSHIP_REQUIRED",
          "폴더 편집 권한 없음",
          403,
        );
        return NextResponse.json(res.body, { status: res.status });
      }
      targetFolderId = f.id;
    } else {
      const workspaceId = await findPersonalWorkflowWorkspaceFolderId(user.id);
      if (!workspaceId) {
        const res = errorResponse(
          "MY_WORKSPACE_MISSING",
          "My Workspace가 없습니다. 관리자에게 문의하세요",
          500,
        );
        return NextResponse.json(res.body, { status: res.status });
      }
      targetFolderId = workspaceId;
    }

    const created = await createWorkflowWithNodes({
      title: title.trim(),
      description: description ?? "",
      nodes: Array.isArray(nodes) ? nodes : undefined,
      version: versionValue,
      parentWorkflowId: parentWorkflowIdValue,
      evaluationContract: evaluationContractValue,
      ownerId: user.id,
      folderId: targetFolderId,
    });

    const res = okResponse(created, 201);
    return NextResponse.json(res.body, { status: res.status });
  },
);
