import { decodeBoolean, decodeTimestamp } from "../value-codecs";
import {
  execute,
  insertAndReturnId,
  query,
  queryOne,
  resolveNodes,
  resolveNodesSlim,
  withTransaction,
} from "@/lib/db";
import type { Workflow } from "@/lib/db";
import type { DbTransactionClient } from "../adapter";

interface WorkflowRow extends Omit<Workflow, "is_active" | "created_at" | "updated_at"> {
  is_active: boolean | number | string;
  created_at: string | Date;
  updated_at: string | Date;
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

function normalizeWorkflow(row: WorkflowRow): Workflow {
  return {
    ...row,
    is_active: decodeBoolean(row.is_active),
    created_at: decodeTimestamp(row.created_at) ?? new Date(0).toISOString(),
    updated_at: decodeTimestamp(row.updated_at) ?? new Date(0).toISOString(),
  };
}

function jsonTextParam(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function incrementWorkflowVersion(version: string): string {
  const trimmed = version.trim();
  if (!trimmed) return "1.0";

  const match = trimmed.match(/^(\d+(?:\.\d+)*)(.*)$/);
  if (!match) return "1.0";

  const numericPrefix = match[1];
  const suffix = match[2];
  const parts = numericPrefix.split(".");
  const last = Number.parseInt(parts[parts.length - 1] ?? "0", 10);
  if (Number.isNaN(last)) return "1.0";
  parts[parts.length - 1] = String(last + 1);
  return parts.join(".") + suffix;
}

async function insertWorkflowNodes(
  client: DbTransactionClient,
  workflowId: number,
  nodes: NodeInput[],
): Promise<void> {
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    await client.query(
      "INSERT INTO workflow_nodes (workflow_id, step_order, node_type, title, instruction, instruction_id, loop_back_to, auto_advance, credential_id, hitl, visual_selection, credential_requirement) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)",
      [
        workflowId,
        i + 1,
        (node.node_type ?? "action").trim(),
        (node.title ?? "").trim(),
        (node.instruction ?? "").trim(),
        node.instruction_id ?? null,
        node.loop_back_to ?? null,
        (node.node_type ?? "action") === "action"
          ? 1
          : node.node_type === "gate"
            ? 0
            : node.auto_advance
              ? 1
              : 0,
        node.credential_id ?? null,
        node.hitl ?? false,
        node.node_type === "gate" ? (node.visual_selection ?? false) : false,
        jsonTextParam(node.credential_requirement),
      ],
    );
  }
}

async function findWorkflowRowByIdWithClient(
  client: DbTransactionClient,
  id: number,
): Promise<Workflow | null> {
  const result = await client.query<WorkflowRow>(
    "SELECT * FROM workflows WHERE id = $1",
    [id],
  );
  return result.rows[0] ? normalizeWorkflow(result.rows[0]) : null;
}

export async function listWorkflowsForVisibilityFilter(input: {
  filterSql: string;
  filterParams: unknown[];
  includeInactive: boolean;
  folderId?: number;
  q?: string;
  slim: boolean;
}): Promise<Array<Workflow & { nodes: unknown[] }>> {
  const clauses: string[] = [input.filterSql];
  const params: unknown[] = [...input.filterParams];

  if (!input.includeInactive) clauses.push("w.is_active = TRUE");
  if (input.folderId !== undefined) {
    params.push(input.folderId);
    clauses.push(
      `w.folder_id IN (
        WITH RECURSIVE ftree AS (
          SELECT id FROM folders WHERE id = $${params.length}
          UNION ALL
          SELECT f.id FROM folders f JOIN ftree ON f.parent_id = ftree.id
        )
        SELECT id FROM ftree
      )`,
    );
  }
  if (input.q) {
    params.push(`%${input.q}%`);
    clauses.push(`LOWER(w.title) LIKE LOWER($${params.length})`);
  }

  const rows = await query<WorkflowRow>(
    `SELECT w.* FROM workflows w WHERE ${clauses.join(" AND ")} ORDER BY w.updated_at DESC`,
    params,
  );

  return Promise.all(
    rows.map(async (row) => {
      const workflow = normalizeWorkflow(row);
      return {
        ...workflow,
        nodes: input.slim
          ? await resolveNodesSlim(workflow.id)
          : await resolveNodes(workflow.id),
      };
    }),
  );
}

export async function findPersonalWorkflowWorkspaceFolderId(
  userId: number,
): Promise<number | null> {
  const row = await queryOne<{ id: number }>(
    "SELECT id FROM folders WHERE owner_id = $1 AND is_system = true AND name = 'My Workspace' LIMIT 1",
    [userId],
  );
  return row?.id ?? null;
}

export async function createWorkflowWithNodes(input: {
  title: string;
  description: string;
  nodes?: NodeInput[];
  version: string;
  parentWorkflowId: number | null;
  evaluationContract: string | null;
  ownerId: number;
  folderId: number;
}): Promise<Workflow & { nodes: unknown[] }> {
  return withTransaction(async (client) => {
    const workflowId = await insertAndReturnId(
      `INSERT INTO workflows (
         title, description, version, parent_workflow_id,
         evaluation_contract, owner_id, folder_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        input.title,
        input.description,
        input.version,
        input.parentWorkflowId,
        input.evaluationContract,
        input.ownerId,
        input.folderId,
      ],
      client,
    );

    await client.query(
      "UPDATE workflows SET family_root_id = $1 WHERE id = $1",
      [workflowId],
    );

    if (Array.isArray(input.nodes)) {
      await insertWorkflowNodes(client, workflowId, input.nodes);
    }

    const workflow = await findWorkflowRowByIdWithClient(client, workflowId);
    if (!workflow) {
      throw new Error("Failed to load created workflow");
    }
    return { ...workflow, nodes: await resolveNodes(workflowId) };
  });
}

export async function updateWorkflowWithOptionalVersion(input: {
  existing: Workflow;
  workflowId: number;
  title?: string;
  description?: string;
  nodes?: NodeInput[];
  version?: string;
  evaluationContract?: unknown;
  createNewVersion: boolean;
}): Promise<Workflow & { nodes: unknown[] }> {
  return withTransaction(async (client) => {
    const shouldCreateNewVersion = Array.isArray(input.nodes) && input.createNewVersion;

    if (shouldCreateNewVersion) {
      const newVersion = incrementWorkflowVersion(input.existing.version);
      const evaluationContractValue =
        input.evaluationContract === undefined
          ? jsonTextParam(input.existing.evaluation_contract)
          : jsonTextParam(input.evaluationContract);

      await client.query(
        `UPDATE workflows SET is_active = FALSE, updated_at = $2
          WHERE family_root_id = $1 AND is_active = TRUE`,
        [input.existing.family_root_id, new Date().toISOString()],
      );

      const newWorkflowId = await insertAndReturnId(
        `INSERT INTO workflows
           (title, description, version, parent_workflow_id, family_root_id,
            is_active, evaluation_contract, owner_id, folder_id)
         VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7, $8)`,
        [
          (input.title ?? input.existing.title).trim(),
          (input.description ?? input.existing.description).trim(),
          newVersion,
          input.workflowId,
          input.existing.family_root_id,
          evaluationContractValue,
          input.existing.owner_id,
          input.existing.folder_id,
        ],
        client,
      );

      await insertWorkflowNodes(client, newWorkflowId, input.nodes ?? []);
      const workflow = await findWorkflowRowByIdWithClient(client, newWorkflowId);
      if (!workflow) throw new Error("Failed to load versioned workflow");
      return { ...workflow, nodes: await resolveNodes(newWorkflowId) };
    }

    const versionValue =
      typeof input.version === "string" && input.version.trim()
        ? input.version.trim()
        : input.existing.version;
    const evaluationContractValue =
      input.evaluationContract === undefined
        ? jsonTextParam(input.existing.evaluation_contract)
        : jsonTextParam(input.evaluationContract);

    await client.query(
      "UPDATE workflows SET title = $1, description = $2, version = $3, evaluation_contract = $4, updated_at = $5 WHERE id = $6",
      [
        (input.title ?? input.existing.title).trim(),
        (input.description ?? input.existing.description).trim(),
        versionValue,
        evaluationContractValue,
        new Date().toISOString(),
        input.workflowId,
      ],
    );

    if (Array.isArray(input.nodes)) {
      await client.query("DELETE FROM workflow_nodes WHERE workflow_id = $1", [
        input.workflowId,
      ]);
      await insertWorkflowNodes(client, input.workflowId, input.nodes);
    }

    const workflow = await findWorkflowRowByIdWithClient(client, input.workflowId);
    if (!workflow) throw new Error("Failed to load updated workflow");
    return { ...workflow, nodes: await resolveNodes(input.workflowId) };
  });
}

export async function moveWorkflowToFolder(input: {
  workflowId: number;
  folderId: number | null;
}): Promise<void> {
  await execute(
    "UPDATE workflows SET folder_id = $1, updated_at = $2 WHERE id = $3",
    [input.folderId, new Date().toISOString(), input.workflowId],
  );
}

export async function deleteWorkflowById(workflowId: number): Promise<void> {
  await execute("DELETE FROM workflows WHERE id = $1", [workflowId]);
}

export async function findWorkflowById(id: number): Promise<Workflow | null> {
  const row = await queryOne<WorkflowRow>(
    "SELECT * FROM workflows WHERE id = $1",
    [id],
  );
  return row ? normalizeWorkflow(row) : null;
}

export async function activateWorkflowVersion(target: Workflow): Promise<Workflow> {
  return withTransaction(async (client) => {
    await client.query(
      `UPDATE workflows SET is_active = FALSE, updated_at = $2
        WHERE family_root_id = $1 AND is_active = TRUE`,
      [target.family_root_id, new Date().toISOString()],
    );
    await client.query(
      `UPDATE workflows SET is_active = TRUE, updated_at = $2 WHERE id = $1`,
      [target.id, new Date().toISOString()],
    );
    const updated = await findWorkflowRowByIdWithClient(client, target.id);
    if (!updated) throw new Error("Failed to load activated workflow");
    return updated;
  });
}

export async function transferWorkflowOwnership(input: {
  workflowId: number;
  newOwnerId: number;
}): Promise<Workflow | null> {
  await execute(
    "UPDATE workflows SET owner_id = $1, updated_at = $2 WHERE id = $3",
    [input.newOwnerId, new Date().toISOString(), input.workflowId],
  );
  const row = await queryOne<WorkflowRow>("SELECT * FROM workflows WHERE id = $1", [
    input.workflowId,
  ]);
  return row ? normalizeWorkflow(row) : null;
}
