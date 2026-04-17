import { NextResponse } from "next/server";
import { type Folder, okResponse, errorResponse } from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import {
  canReadFolder,
  canEditFolder,
  canDeleteFolder,
  type OwnedFolder,
} from "@/lib/authorization";
import { loadResourceOrFail } from "@/lib/api-helpers";
import {
  deleteFolderById,
  getFolderUsageCounts,
  updateFolderById,
} from "@/lib/db/repositories/folders";

type Params = { params: Promise<{ id: string }> };

export const GET = withAuth<Params>(
  "workflows:read",
  async (_request, user, { params }) => {
    const { id } = await params;
    const { resource: folder, response: errResp } =
      await loadResourceOrFail<Folder>({
        table: "folders",
        id,
        user,
        check: (u, f) => canReadFolder(u, f as unknown as OwnedFolder),
        notFoundMessage: "폴더를 찾을 수 없습니다",
        forbiddenMessage: "접근 권한 없음",
      });
    if (errResp) return errResp;
    const res = okResponse(folder);
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const PUT = withAuth<Params>(
  "workflows:update",
  async (request, user, { params }) => {
    const { id } = await params;
    const body = await request.json();
    const { name, description, parent_id } = body;

    const { resource: folder, response: errResp } =
      await loadResourceOrFail<Folder>({
        table: "folders",
        id,
        user,
        check: (u, f) => canEditFolder(u, f as unknown as OwnedFolder),
        notFoundMessage: "폴더를 찾을 수 없습니다",
        forbiddenMessage: "편집 권한 없음",
      });
    if (errResp) return errResp;

    if (folder.is_system && (name !== undefined || parent_id !== undefined)) {
      const res = errorResponse(
        "OWNERSHIP_REQUIRED",
        "시스템 폴더의 이름/위치는 변경할 수 없습니다",
        403,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    const updated = await updateFolderById({
      id: Number(id),
      name: name ?? null,
      description: description ?? null,
      parentId: parent_id ?? null,
    });
    const res = okResponse(updated);
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const DELETE = withAuth<Params>(
  "workflows:delete",
  async (_request, user, { params }) => {
    const { id } = await params;
    const { response: errResp } = await loadResourceOrFail<Folder>({
      table: "folders",
      id,
      user,
      check: (u, f) => canDeleteFolder(u, f as unknown as OwnedFolder),
      notFoundMessage: "폴더를 찾을 수 없습니다",
      forbiddenMessage: "삭제 권한 없음",
    });
    if (errResp) return errResp;

    // Emptiness check — consolidated into a single round trip
    const usage = await getFolderUsageCounts(Number(id));
    const total =
      usage.workflow_count + usage.instruction_count + usage.child_count;

    if (total > 0) {
      const res = errorResponse(
        "FOLDER_NOT_EMPTY",
        "비어있지 않은 폴더는 삭제할 수 없습니다",
        409,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    await deleteFolderById(Number(id));
    const res = okResponse({ id: Number(id), deleted: true });
    return NextResponse.json(res.body, { status: res.status });
  },
);
