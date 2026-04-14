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
  params: Promise<{ id: string; nodeId: string; attachId: string }>;
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
    const { id, nodeId, attachId } = await params;
    const workflowId = Number(id);
    const resolvedNodeId = Number(nodeId);
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

    const attachment = await loadAttachment(
      attachmentId,
      resolvedNodeId,
      workflowId,
    );
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

    const base64 = attachment.content_binary
      ? Buffer.from(attachment.content_binary).toString("base64")
      : null;
    const res = okResponse({
      id: attachment.id,
      filename: attachment.filename,
      mime_type: attachment.mime_type,
      size_bytes: attachment.size_bytes,
      binary: true,
      content_base64: base64,
    });
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const DELETE = withAuth<Params>(
  "workflows:update",
  async (_request, user, { params }) => {
    const { id, nodeId, attachId } = await params;
    const workflowId = Number(id);
    const resolvedNodeId = Number(nodeId);
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

    const attachment = await loadAttachment(
      attachmentId,
      resolvedNodeId,
      workflowId,
    );
    if (!attachment) {
      const res = errorResponse(
        "NOT_FOUND",
        "첨부 파일을 찾을 수 없습니다",
        404,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    await execute("DELETE FROM node_attachments WHERE id = $1", [attachmentId]);

    const res = okResponse({ id: attachmentId, deleted: true });
    return NextResponse.json(res.body, { status: res.status });
  },
);
