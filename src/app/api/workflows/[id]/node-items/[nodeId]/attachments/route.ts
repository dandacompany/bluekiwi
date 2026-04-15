import { NextResponse } from "next/server";
import {
  insertAndReturnId,
  listResponse,
  query,
  queryOne,
  Workflow,
  okResponse,
  errorResponse,
} from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import { canEdit, canRead } from "@/lib/authorization";
import { loadResourceOrFail } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string; nodeId: string }> };

const MAX_SIZE = 5 * 1024 * 1024;

function isTextMimeType(mimeType: string): boolean {
  if (mimeType.startsWith("text/")) return true;
  return [
    "application/json",
    "application/ld+json",
    "application/xml",
    "application/javascript",
    "application/x-javascript",
    "application/typescript",
    "application/x-typescript",
    "application/yaml",
    "application/x-yaml",
    "application/toml",
    "application/x-sh",
    "application/x-shellscript",
    "application/x-python",
  ].includes(mimeType);
}

async function verifyNodeBelongsToWorkflow(
  nodeId: number,
  workflowId: number,
): Promise<boolean> {
  const row = await queryOne<{ id: number }>(
    "SELECT id FROM workflow_nodes WHERE id = $1 AND workflow_id = $2",
    [nodeId, workflowId],
  );
  return !!row;
}

export const GET = withAuth<Params>(
  "workflows:read",
  async (_request, user, { params }) => {
    const { id, nodeId } = await params;
    const workflowId = Number(id);
    const resolvedNodeId = Number(nodeId);

    const { resource: workflow, response: errResp } =
      await loadResourceOrFail<Workflow>({
        table: "workflows",
        id: workflowId,
        user,
        check: canRead,
        notFoundMessage: "워크플로를 찾을 수 없습니다",
        forbiddenMessage: "조회 권한 없음",
      });
    if (errResp) return errResp;
    void workflow;

    if (!(await verifyNodeBelongsToWorkflow(resolvedNodeId, workflowId))) {
      const res = errorResponse("NOT_FOUND", "노드를 찾을 수 없습니다", 404);
      return NextResponse.json(res.body, { status: res.status });
    }

    const rows = await query<{
      id: number;
      filename: string;
      mime_type: string;
      size_bytes: number;
      created_at: string;
    }>(
      `SELECT id, filename, mime_type, size_bytes, created_at
         FROM node_attachments
        WHERE node_id = $1
        ORDER BY created_at`,
      [resolvedNodeId],
    );

    const res = listResponse(rows, rows.length);
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const POST = withAuth<Params>(
  "workflows:update",
  async (request, user, { params }) => {
    const { id, nodeId } = await params;
    const workflowId = Number(id);
    const resolvedNodeId = Number(nodeId);

    const { resource: workflow, response: errResp } =
      await loadResourceOrFail<Workflow>({
        table: "workflows",
        id: workflowId,
        user,
        check: canEdit,
        notFoundMessage: "워크플로를 찾을 수 없습니다",
        forbiddenMessage: "편집 권한 없음",
      });
    if (errResp) return errResp;
    void workflow;

    if (!(await verifyNodeBelongsToWorkflow(resolvedNodeId, workflowId))) {
      const res = errorResponse("NOT_FOUND", "노드를 찾을 수 없습니다", 404);
      return NextResponse.json(res.body, { status: res.status });
    }

    const formData = await request.formData();
    const entry = formData.get("file");
    const file = entry instanceof File ? entry : null;

    if (!file) {
      const res = errorResponse("VALIDATION_ERROR", "file is required", 400);
      return NextResponse.json(res.body, { status: res.status });
    }

    if (file.size > MAX_SIZE) {
      const res = errorResponse(
        "VALIDATION_ERROR",
        "File too large (max 5MB)",
        400,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    const mimeType = file.type || "application/octet-stream";
    const buffer = Buffer.from(await file.arrayBuffer());
    const storeAsText = isTextMimeType(mimeType);

    const attachmentId = storeAsText
      ? await insertAndReturnId(
          `INSERT INTO node_attachments
            (node_id, filename, mime_type, size_bytes, content)
           VALUES ($1, $2, $3, $4, $5)`,
          [resolvedNodeId, file.name, mimeType, file.size, buffer.toString("utf-8")],
        )
      : await insertAndReturnId(
          `INSERT INTO node_attachments
            (node_id, filename, mime_type, size_bytes, content_binary)
           VALUES ($1, $2, $3, $4, $5)`,
          [resolvedNodeId, file.name, mimeType, file.size, buffer],
        );

    const res = okResponse(
      {
        id: attachmentId,
        filename: file.name,
        mime_type: mimeType,
        size_bytes: file.size,
      },
      201,
    );
    return NextResponse.json(res.body, { status: res.status });
  },
);
