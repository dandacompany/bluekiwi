import { NextRequest, NextResponse } from "next/server";
import { Workflow, okResponse, resolveNodes } from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import {
  canDelete,
  canEdit,
  canEditFolder,
  canRead,
  loadFolder,
} from "@/lib/authorization";
import { loadResourceOrFail, withResource } from "@/lib/api-helpers";
import {
  deleteWorkflowById,
  moveWorkflowToFolder,
  updateWorkflowWithOptionalVersion,
  WorkflowNodeInUseError,
} from "@/lib/db/repositories/workflows";

type Params = { params: Promise<{ id: string }> };

export const GET = withResource<Workflow>({
  permission: "workflows:read",
  table: "workflows",
  check: canRead,
  notFoundMessage: "워크플로를 찾을 수 없습니다",
  forbiddenMessage: "접근 권한 없음",
  handler: async ({ resource: workflow }) => {
    const res = okResponse({
      ...workflow,
      nodes: await resolveNodes(workflow.id),
    });
    return NextResponse.json(res.body, { status: res.status });
  },
});

export const PUT = withAuth<Params>(
  "workflows:update",
  async (request: NextRequest, user, { params }: Params) => {
    const { id } = await params;
    const body = await request.json();
    const {
      title,
      description,
      nodes,
      version,
      evaluation_contract,
      create_new_version,
    } = body;
    const workflowId = Number(id);

    const { resource: existing, response: errResp } =
      await loadResourceOrFail<Workflow>({
        table: "workflows",
        id: workflowId,
        user,
        check: canEdit,
        notFoundMessage: "워크플로를 찾을 수 없습니다",
        forbiddenMessage: "편집 권한 없음",
      });
    if (errResp) return errResp;

    try {
      const updated = await updateWorkflowWithOptionalVersion({
        existing,
        workflowId,
        title,
        description,
        nodes: Array.isArray(nodes) ? nodes : undefined,
        version,
        evaluationContract: evaluation_contract,
        createNewVersion: create_new_version === true,
      });

      const res = okResponse(updated);
      return NextResponse.json(res.body, { status: res.status });
    } catch (err) {
      if (err instanceof WorkflowNodeInUseError) {
        return NextResponse.json(
          {
            error: {
              code: err.code,
              message: err.message,
              referenced_node_ids: err.referencedNodeIds,
            },
          },
          { status: 409 },
        );
      }
      throw err;
    }
  },
);

/** PATCH — lightweight field updates (e.g. folder_id move) */
export const PATCH = withAuth<Params>(
  "workflows:update",
  async (request: NextRequest, user, { params }: Params) => {
    const { id } = await params;
    const body = await request.json();
    const workflowId = Number(id);

    const { response: errResp } = await loadResourceOrFail<Workflow>({
      table: "workflows",
      id: workflowId,
      user,
      check: canEdit,
      notFoundMessage: "워크플로를 찾을 수 없습니다",
      forbiddenMessage: "편집 권한 없음",
    });
    if (errResp) return errResp;

    if ("folder_id" in body) {
      const folderId = body.folder_id === null ? null : Number(body.folder_id);
      if (folderId !== null) {
        const targetFolder = await loadFolder(folderId);
        if (!targetFolder) {
          return NextResponse.json(
            {
              error: {
                code: "NOT_FOUND",
                message: "대상 폴더를 찾을 수 없습니다",
              },
            },
            { status: 404 },
          );
        }
        if (!(await canEditFolder(user, targetFolder))) {
          return NextResponse.json(
            {
              error: {
                code: "FORBIDDEN",
                message: "대상 폴더에 대한 편집 권한이 없습니다",
              },
            },
            { status: 403 },
          );
        }
      }
      await moveWorkflowToFolder({ workflowId, folderId });
    }

    const res = okResponse({ id: workflowId, updated: true });
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const DELETE = withResource<Workflow>({
  permission: "workflows:update",
  table: "workflows",
  check: canDelete,
  notFoundMessage: "워크플로를 찾을 수 없습니다",
  forbiddenMessage: "삭제 권한 없음",
  handler: async ({ resource: existing }) => {
    await deleteWorkflowById(existing.id);
    const res = okResponse({ id: existing.id, deleted: true });
    return NextResponse.json(res.body, { status: res.status });
  },
});
