import { NextResponse } from "next/server";
import {
  execute,
  queryOne,
  Workflow,
  okResponse,
  errorResponse,
} from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import { canEdit, canRead } from "@/lib/authorization";
import { loadResourceOrFail } from "@/lib/api-helpers";

type Params = {
  params: Promise<{ id: string; node_id: string; attachId: string }>;
};

type NodeAttachment = {
  id: number;
  node_id: number;
  filename: string;
  mime_type: string;
  size_bytes: number;
  content: string | null;
  content_binary: Buffer | null;
  created_at: string;
};

async function loadAttachment(
  attachId: number,
  nodeId: number,
  workflowId: number,
): Promise<NodeAttachment | undefined> {
  return queryOne<NodeAttachment>(
    `SELECT a.*
       FROM node_attachments a
       JOIN workflow_nodes n ON n.id = a.node_id
      WHERE a.id = $1
        AND a.node_id = $2
        AND n.workflow_id = $3`,
    [attachId, nodeId, workflowId],
  );
}

export const GET = withAuth<Params>(
  "workflows:read",
  async (_request, user, { params }) => {
    const { id, node_id, attachId } = await params;
    const workflowId = Number(id);
    const nodeId = Number(node_id);
    const attachmentId = Number(attachId);

    const { response: errResp } = await loadResourceOrFail<Workflow>({
      table: "workflows",
      id: workflowId,
      user,
      check: canRead,
      notFoundMessage: "워크플로를 찾을 수 없습니다",
      forbiddenMessage: "조회 권한 없음",
    });
    if (errResp) return errResp;

    const attachment = await loadAttachment(attachmentId, nodeId, workflowId);
    if (!attachment) {
      const res = errorResponse(
        "NOT_FOUND",
        "첨부 파일을 찾을 수 없습니다",
        404,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    if (attachment.content !== null) {
      const res = okResponse({
        id: attachment.id,
        filename: attachment.filename,
        mime_type: attachment.mime_type,
        size_bytes: attachment.size_bytes,
        content: attachment.content,
      });
      return NextResponse.json(res.body, { status: res.status });
    }

    if (attachment.content_binary !== null) {
      return new NextResponse(new Uint8Array(attachment.content_binary), {
        headers: {
          "Content-Type": attachment.mime_type,
          "Content-Disposition": `attachment; filename="${attachment.filename}"`,
          "Content-Length": String(attachment.size_bytes),
        },
      });
    }

    const res = errorResponse("NOT_FOUND", "파일 내용이 없습니다", 404);
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const DELETE = withAuth<Params>(
  "workflows:update",
  async (_request, user, { params }) => {
    const { id, node_id, attachId } = await params;
    const workflowId = Number(id);
    const nodeId = Number(node_id);
    const attachmentId = Number(attachId);

    const { response: errResp } = await loadResourceOrFail<Workflow>({
      table: "workflows",
      id: workflowId,
      user,
      check: canEdit,
      notFoundMessage: "워크플로를 찾을 수 없습니다",
      forbiddenMessage: "편집 권한 없음",
    });
    if (errResp) return errResp;

    const attachment = await loadAttachment(attachmentId, nodeId, workflowId);
    if (!attachment) {
      const res = errorResponse(
        "NOT_FOUND",
        "첨부 파일을 찾을 수 없습니다",
        404,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    await execute("DELETE FROM node_attachments WHERE id = $1", [
      attachment.id,
    ]);

    const res = okResponse({ id: attachment.id, deleted: true });
    return NextResponse.json(res.body, { status: res.status });
  },
);
