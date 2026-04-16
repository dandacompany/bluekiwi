import { decodeTimestamp } from "../value-codecs";
import { execute, insertAndReturnId, query, queryOne } from "@/lib/db";
import type { Instruction } from "@/lib/db";

interface InstructionRow extends Omit<
  Instruction,
  "created_at" | "updated_at"
> {
  created_at: string | Date;
  updated_at: string | Date;
}

function normalizeInstruction(row: InstructionRow): Instruction {
  return {
    ...row,
    created_at: decodeTimestamp(row.created_at) ?? new Date(0).toISOString(),
    updated_at: decodeTimestamp(row.updated_at) ?? new Date(0).toISOString(),
  };
}

export async function listInstructionsForVisibilityFilter(
  filterSql: string,
  filterParams: unknown[],
  folderId?: number,
): Promise<Instruction[]> {
  const params: unknown[] = [...filterParams];
  const clauses = [filterSql];

  if (folderId !== undefined) {
    params.push(folderId);
    clauses.push(`i.folder_id = $${params.length}`);
  }

  const rows = await query<InstructionRow>(
    `SELECT i.* FROM instructions i WHERE ${clauses.join(" AND ")} ORDER BY i.updated_at DESC`,
    params,
  );
  return rows.map(normalizeInstruction);
}

export async function findPersonalWorkspaceFolderIdForUser(
  userId: number,
): Promise<number | null> {
  const row = await queryOne<{ id: number }>(
    "SELECT id FROM folders WHERE is_system = true AND visibility = 'personal' AND owner_id = $1 LIMIT 1",
    [userId],
  );
  return row?.id ?? null;
}

export async function createInstruction(input: {
  title: string;
  content: string;
  agentType: string;
  tagsJson: string;
  priority: number;
  ownerId: number;
  folderId: number;
  credentialId?: number | null;
}): Promise<Instruction | null> {
  const id = await insertAndReturnId(
    `INSERT INTO instructions (title, content, agent_type, tags, priority, owner_id, folder_id, credential_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      input.title,
      input.content,
      input.agentType,
      input.tagsJson,
      input.priority,
      input.ownerId,
      input.folderId,
      input.credentialId ?? null,
    ],
  );
  return findInstructionById(id);
}

export async function findInstructionById(
  id: number,
): Promise<Instruction | null> {
  const row = await queryOne<InstructionRow>(
    "SELECT * FROM instructions WHERE id = $1",
    [id],
  );
  return row ? normalizeInstruction(row) : null;
}

export async function updateInstructionById(input: {
  id: number;
  title: string;
  content: string;
  agentType: string;
  tagsJson: string;
  priority: number;
  isActive: number;
  credentialId?: number | null;
}): Promise<Instruction | null> {
  await execute(
    `UPDATE instructions
     SET title = $1, content = $2, agent_type = $3, tags = $4, priority = $5, is_active = $6, updated_at = $7, credential_id = $8
     WHERE id = $9`,
    [
      input.title,
      input.content,
      input.agentType,
      input.tagsJson,
      input.priority,
      input.isActive,
      new Date().toISOString(),
      input.credentialId ?? null,
      input.id,
    ],
  );
  return findInstructionById(input.id);
}

export async function countInstructionNodeReferences(
  id: number,
): Promise<number> {
  const row = await queryOne<{ c: string | number }>(
    "SELECT COUNT(*) AS c FROM workflow_nodes WHERE instruction_id = $1",
    [id],
  );
  return Number(row?.c ?? 0);
}

export async function deleteInstructionById(id: number): Promise<number> {
  const result = await execute("DELETE FROM instructions WHERE id = $1", [id]);
  return result.rowCount;
}

export async function transferInstructionOwnership(input: {
  id: number;
  newOwnerId: number;
}): Promise<Instruction | null> {
  await execute(
    "UPDATE instructions SET owner_id = $1, updated_at = $2 WHERE id = $3",
    [input.newOwnerId, new Date().toISOString(), input.id],
  );
  return findInstructionById(input.id);
}
