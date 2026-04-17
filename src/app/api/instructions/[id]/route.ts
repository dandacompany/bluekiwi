import { NextRequest, NextResponse } from "next/server";
import { Instruction, okResponse, errorResponse } from "@/lib/db";
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
  countInstructionNodeReferences,
  deleteInstructionById,
  moveInstructionToFolder,
  updateInstructionById,
} from "@/lib/db/repositories/instructions";

type Params = { params: Promise<{ id: string }> };

export const GET = withResource<Instruction>({
  permission: "workflows:read",
  table: "instructions",
  check: canRead,
  notFoundMessage: "지침을 찾을 수 없습니다",
  forbiddenMessage: "접근 권한 없음",
  handler: async ({ resource }) => {
    const res = okResponse(resource);
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
      content,
      agent_type,
      tags,
      priority,
      is_active,
      credential_id,
    } = body;

    const { resource: existing, response: errResp } =
      await loadResourceOrFail<Instruction>({
        table: "instructions",
        id,
        user,
        check: canEdit,
        notFoundMessage: "지침을 찾을 수 없습니다",
        forbiddenMessage: "편집 권한 없음",
      });
    if (errResp) return errResp;

    const newTags =
      tags !== undefined
        ? JSON.stringify(
            Array.isArray(tags) ? tags.map((t: string) => t.trim()) : [],
          )
        : existing.tags;

    const updated = await updateInstructionById({
      id: Number(id),
      title: (title ?? existing.title).trim(),
      content: (content ?? existing.content).trim(),
      agentType: (agent_type ?? existing.agent_type).trim(),
      tagsJson: newTags,
      priority: typeof priority === "number" ? priority : existing.priority,
      isActive:
        is_active !== undefined
          ? is_active
            ? 1
            : 0
          : existing.is_active
            ? 1
            : 0,
      credentialId:
        credential_id !== undefined
          ? typeof credential_id === "number"
            ? credential_id
            : null
          : existing.credential_id,
    });

    const res = okResponse(updated);
    return NextResponse.json(res.body, { status: res.status });
  },
);

/** PATCH — lightweight field updates (e.g. folder_id move) */
export const PATCH = withAuth<Params>(
  "workflows:update",
  async (request: NextRequest, user, { params }: Params) => {
    const { id } = await params;
    const body = await request.json();
    const instructionId = Number(id);

    const { response: errResp } = await loadResourceOrFail<Instruction>({
      table: "instructions",
      id: instructionId,
      user,
      check: canEdit,
      notFoundMessage: "지침을 찾을 수 없습니다",
      forbiddenMessage: "편집 권한 없음",
    });
    if (errResp) return errResp;

    if ("folder_id" in body) {
      const folderId = body.folder_id === null ? null : Number(body.folder_id);
      if (folderId === null) {
        const res = errorResponse(
          "VALIDATION_ERROR",
          "folder_id는 null일 수 없습니다",
          400,
        );
        return NextResponse.json(res.body, { status: res.status });
      }
      const targetFolder = await loadFolder(folderId);
      if (!targetFolder) {
        const res = errorResponse(
          "NOT_FOUND",
          "대상 폴더를 찾을 수 없습니다",
          404,
        );
        return NextResponse.json(res.body, { status: res.status });
      }
      if (!(await canEditFolder(user, targetFolder))) {
        const res = errorResponse(
          "FORBIDDEN",
          "대상 폴더에 대한 편집 권한이 없습니다",
          403,
        );
        return NextResponse.json(res.body, { status: res.status });
      }
      await moveInstructionToFolder({ instructionId, folderId });
    }

    const res = okResponse({ id: instructionId, updated: true });
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const DELETE = withAuth<Params>(
  "workflows:delete",
  async (_request, user, { params }: Params) => {
    const { id } = await params;

    const { response: errResp } = await loadResourceOrFail<Instruction>({
      table: "instructions",
      id,
      user,
      check: canDelete,
      notFoundMessage: "지침을 찾을 수 없습니다",
      forbiddenMessage: "삭제 권한 없음",
    });
    if (errResp) return errResp;

    // Refuse delete if any workflow_nodes still reference this instruction.
    // The DB-level RESTRICT FK is the ultimate guard, but we front-load a
    // friendly count-aware error so the UI can show something meaningful.
    const refCount = await countInstructionNodeReferences(Number(id));
    if (refCount > 0) {
      const res = errorResponse(
        "INSTRUCTION_IN_USE",
        `이 지침은 ${refCount}개의 워크플로 노드에서 사용 중이라 삭제할 수 없습니다. 해당 워크플로에서 먼저 지침을 분리하세요.`,
        409,
        { count: refCount },
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    const deletedCount = await deleteInstructionById(Number(id));

    if (deletedCount === 0) {
      const res = errorResponse("NOT_FOUND", "지침을 찾을 수 없습니다", 404);
      return NextResponse.json(res.body, { status: res.status });
    }

    const res = okResponse({ id: Number(id), deleted: true });
    return NextResponse.json(res.body, { status: res.status });
  },
);
