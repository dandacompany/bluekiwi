import { decodeBoolean, decodeTimestamp } from "../value-codecs";
import { insertAndReturnId, query, queryOne, withTransaction } from "@/lib/db";
import type { WorkflowNode } from "@/lib/db";
import type { DbTransactionClient } from "../adapter";

export class WorkflowNodeDeletionBlockedError extends Error {
  constructor(
    public readonly nodeId: number,
    public readonly referenceCount: number,
  ) {
    super(
      `Cannot delete workflow node ${nodeId}; ${referenceCount} task log reference(s) exist`,
    );
    this.name = "WorkflowNodeDeletionBlockedError";
  }
}

interface WorkflowNodeRow extends Omit<
  WorkflowNode,
  "hitl" | "visual_selection" | "created_at" | "credential_requirement_parsed"
> {
  hitl: boolean | number | string;
  visual_selection: boolean | number | string;
  created_at: string | Date;
}

interface NodeAttachmentRow {
  id: number;
  filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string | Date;
}

interface NodeInput {
  title: string;
  instruction?: string;
  instruction_id?: number;
  credential_id?: number;
  credential_requirement?: unknown;
  hitl?: boolean;
  visual_selection?: boolean;
  node_type?: string;
  loop_back_to?: number;
  auto_advance?: boolean;
}

function normalizeWorkflowNode(row: WorkflowNodeRow): WorkflowNode {
  return {
    ...row,
    hitl: decodeBoolean(row.hitl),
    visual_selection: decodeBoolean(row.visual_selection),
    created_at: decodeTimestamp(row.created_at) ?? new Date(0).toISOString(),
  };
}

function normalizeNodeAttachment(row: NodeAttachmentRow): NodeAttachmentRow {
  return {
    ...row,
    created_at: decodeTimestamp(row.created_at) ?? new Date(0).toISOString(),
  };
}

function enforceAutoAdvance(nodeType: string): number {
  if (nodeType === "action") return 1;
  if (nodeType === "gate") return 0;
  return 0;
}

function jsonTextParam(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

async function findNodeRowByIdWithClient(
  client: DbTransactionClient,
  nodeId: number,
): Promise<WorkflowNode | null> {
  const result = await client.query<WorkflowNodeRow>(
    "SELECT * FROM workflow_nodes WHERE id = $1",
    [nodeId],
  );
  return result.rows[0] ? normalizeWorkflowNode(result.rows[0]) : null;
}

export async function findWorkflowNodeById(
  nodeId: number,
  workflowId: number,
): Promise<WorkflowNode | null> {
  const row = await queryOne<WorkflowNodeRow>(
    "SELECT * FROM workflow_nodes WHERE id = $1 AND workflow_id = $2",
    [nodeId, workflowId],
  );
  return row ? normalizeWorkflowNode(row) : null;
}

export async function createWorkflowNode(input: {
  workflowId: number;
  afterStep: number | null;
  node: NodeInput;
}): Promise<WorkflowNode> {
  return withTransaction(async (client) => {
    let newStepOrder: number;

    if (input.afterStep !== null) {
      await client.query(
        "UPDATE workflow_nodes SET step_order = step_order + 1 WHERE workflow_id = $1 AND step_order > $2",
        [input.workflowId, input.afterStep],
      );
      newStepOrder = input.afterStep + 1;
    } else {
      const maxRow = await client.query<{ max: number | null }>(
        "SELECT MAX(step_order) as max FROM workflow_nodes WHERE workflow_id = $1",
        [input.workflowId],
      );
      newStepOrder = Number(maxRow.rows[0]?.max ?? 0) + 1;
    }

    const resolvedNodeType = (input.node.node_type ?? "action").trim();
    const autoAdvance = enforceAutoAdvance(resolvedNodeType);

    const nodeId = await insertAndReturnId(
      `INSERT INTO workflow_nodes
         (workflow_id, step_order, node_type, title, instruction, instruction_id,
          loop_back_to, auto_advance, credential_id, hitl, visual_selection, credential_requirement)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `,
      [
        input.workflowId,
        newStepOrder,
        resolvedNodeType,
        input.node.title.trim(),
        (input.node.instruction ?? "").trim(),
        input.node.instruction_id ?? null,
        resolvedNodeType === "loop" ? (input.node.loop_back_to ?? null) : null,
        autoAdvance,
        input.node.credential_id ?? null,
        input.node.hitl ?? false,
        resolvedNodeType === "gate"
          ? (input.node.visual_selection ?? false)
          : false,
        jsonTextParam(input.node.credential_requirement),
      ],
      client,
    );

    const row = await findNodeRowByIdWithClient(client, nodeId);
    if (!row) throw new Error("Failed to create workflow node");
    return row;
  });
}

export async function updateWorkflowNode(input: {
  workflowId: number;
  nodeId: number;
  body: Record<string, unknown>;
}): Promise<WorkflowNode | null> {
  const existing = await findWorkflowNodeById(input.nodeId, input.workflowId);
  if (!existing) return null;

  const newNodeType = String(input.body.node_type ?? existing.node_type);
  const autoAdvance = enforceAutoAdvance(newNodeType);

  return withTransaction(async (client) => {
    await client.query(
      `UPDATE workflow_nodes SET
         title = COALESCE($1, title),
         instruction = COALESCE($2, instruction),
         node_type = $3,
         auto_advance = $4,
         hitl = COALESCE($5, hitl),
         visual_selection = COALESCE($6, visual_selection),
         instruction_id = COALESCE($7, instruction_id),
         credential_id = COALESCE($8, credential_id),
         loop_back_to = COALESCE($9, loop_back_to),
         credential_requirement = COALESCE($10, credential_requirement)
       WHERE id = $11`,
      [
        input.body.title ?? null,
        input.body.instruction ?? null,
        newNodeType,
        autoAdvance,
        input.body.hitl ?? null,
        input.body.visual_selection != null
          ? newNodeType === "gate"
            ? input.body.visual_selection
            : false
          : null,
        input.body.instruction_id ?? null,
        input.body.credential_id ?? null,
        input.body.loop_back_to ?? null,
        input.body.credential_requirement
          ? jsonTextParam(input.body.credential_requirement)
          : null,
        input.nodeId,
      ],
    );

    return findNodeRowByIdWithClient(client, input.nodeId);
  });
}

export async function deleteWorkflowNode(input: {
  workflowId: number;
  nodeId: number;
}): Promise<boolean> {
  const existing = await queryOne<{ step_order: number }>(
    "SELECT step_order FROM workflow_nodes WHERE id = $1 AND workflow_id = $2",
    [input.nodeId, input.workflowId],
  );
  if (!existing) return false;

  const references = await queryOne<{ count: number | string }>(
    "SELECT COUNT(*) AS count FROM task_logs WHERE node_id = $1",
    [input.nodeId],
  );
  const referenceCount = Number(references?.count ?? 0);
  if (referenceCount > 0) {
    throw new WorkflowNodeDeletionBlockedError(input.nodeId, referenceCount);
  }

  await withTransaction(async (client) => {
    await client.query("DELETE FROM workflow_nodes WHERE id = $1", [
      input.nodeId,
    ]);
    await client.query(
      "UPDATE workflow_nodes SET step_order = step_order - 1 WHERE workflow_id = $1 AND step_order > $2",
      [input.workflowId, existing.step_order],
    );
  });

  return true;
}

export async function nodeBelongsToWorkflow(
  nodeId: number,
  workflowId: number,
): Promise<boolean> {
  const row = await queryOne<{ id: number }>(
    "SELECT id FROM workflow_nodes WHERE id = $1 AND workflow_id = $2",
    [nodeId, workflowId],
  );
  return Boolean(row);
}

export async function listNodeAttachments(
  nodeId: number,
): Promise<NodeAttachmentRow[]> {
  const rows = await query<NodeAttachmentRow>(
    `SELECT id, filename, mime_type, size_bytes, created_at
       FROM node_attachments
      WHERE node_id = $1
      ORDER BY created_at`,
    [nodeId],
  );
  return rows.map(normalizeNodeAttachment);
}

export async function createNodeAttachment(input: {
  nodeId: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  textContent?: string;
  binaryContent?: Buffer;
}): Promise<number> {
  if (input.textContent !== undefined) {
    return insertAndReturnId(
      `INSERT INTO node_attachments
        (node_id, filename, mime_type, size_bytes, content)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        input.nodeId,
        input.filename,
        input.mimeType,
        input.sizeBytes,
        input.textContent,
      ],
    );
  }

  return insertAndReturnId(
    `INSERT INTO node_attachments
      (node_id, filename, mime_type, size_bytes, content_binary)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      input.nodeId,
      input.filename,
      input.mimeType,
      input.sizeBytes,
      input.binaryContent ?? null,
    ],
  );
}
