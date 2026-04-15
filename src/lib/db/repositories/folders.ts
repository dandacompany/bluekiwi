import { decodeBoolean, decodeTimestamp } from "../value-codecs";
import { execute, insertAndReturnId, query, queryOne } from "@/lib/db";
import type { Folder, FolderShare } from "@/lib/db";

interface FolderRow extends Omit<Folder, "is_system" | "created_at" | "updated_at"> {
  is_system: boolean | number | string;
  created_at: string | Date;
  updated_at: string | Date;
}

interface FolderWithOwnerRow extends FolderRow {
  is_mine: boolean | number | string;
  owner_name: string;
}

interface FolderUsageRow {
  workflow_count: number | string;
  instruction_count: number | string;
  credential_count: number | string;
  child_count: number | string;
}

interface FolderShareRow extends Omit<FolderShare, "created_at"> {
  created_at: string | Date;
}

function normalizeFolder(row: FolderRow): Folder {
  return {
    ...row,
    is_system: decodeBoolean(row.is_system),
    created_at: decodeTimestamp(row.created_at) ?? new Date(0).toISOString(),
    updated_at: decodeTimestamp(row.updated_at) ?? new Date(0).toISOString(),
  };
}

function normalizeFolderShare(row: FolderShareRow): FolderShare {
  return {
    ...row,
    created_at: decodeTimestamp(row.created_at) ?? new Date(0).toISOString(),
  };
}

async function findFolderById(id: number): Promise<Folder | null> {
  const row = await queryOne<FolderRow>("SELECT * FROM folders WHERE id = $1", [id]);
  return row ? normalizeFolder(row) : null;
}

export async function listFoldersForVisibilityFilter(
  filterSql: string,
  filterParams: unknown[],
  currentUserId: number,
  parentId: number | null | undefined,
): Promise<Array<Folder & { is_mine: boolean; owner_name: string }>> {
  const ownParam = filterParams.length + 1;
  let sql = `SELECT f.*,\n      (f.owner_id = $${ownParam}) AS is_mine,\n      u.username AS owner_name\n    FROM folders f\n    JOIN users u ON u.id = f.owner_id\n    WHERE ${filterSql}`;
  const params = [...filterParams, currentUserId];

  if (parentId !== undefined) {
    params.push(parentId);
    sql += parentId === null ? " AND f.parent_id IS NULL" : ` AND f.parent_id = $${params.length}`;
  }

  sql += " ORDER BY f.name ASC";

  const rows = await query<FolderWithOwnerRow>(sql, params);
  return rows.map((row) => ({
    ...normalizeFolder(row),
    is_mine: decodeBoolean(row.is_mine),
    owner_name: row.owner_name,
  }));
}

export async function createFolder(input: {
  name: string;
  description: string;
  ownerId: number;
  parentId: number | null;
  visibility: Folder["visibility"];
}): Promise<Folder | null> {
  const id = await insertAndReturnId(
    `INSERT INTO folders (name, description, owner_id, parent_id, visibility)\n     VALUES ($1, $2, $3, $4, $5)`,
    [input.name, input.description, input.ownerId, input.parentId, input.visibility],
  );
  return findFolderById(id);
}

export async function updateFolderById(input: {
  id: number;
  name: string | null;
  description: string | null;
  parentId: number | null;
}): Promise<Folder | null> {
  await execute(
    `UPDATE folders SET\n       name = COALESCE($1, name),\n       description = COALESCE($2, description),\n       parent_id = COALESCE($3, parent_id),\n       updated_at = $4\n     WHERE id = $5`,
    [input.name, input.description, input.parentId, new Date().toISOString(), input.id],
  );
  return findFolderById(input.id);
}

export async function transferFolderOwnership(input: {
  id: number;
  newOwnerId: number;
}): Promise<Folder | null> {
  await execute(
    "UPDATE folders SET owner_id = $1, updated_at = $2 WHERE id = $3",
    [input.newOwnerId, new Date().toISOString(), input.id],
  );
  return findFolderById(input.id);
}

export async function getFolderUsageCounts(folderId: number): Promise<{
  workflow_count: number;
  instruction_count: number;
  credential_count: number;
  child_count: number;
}> {
  const row = await queryOne<FolderUsageRow>(
    `SELECT\n       (SELECT COUNT(*) FROM workflows    WHERE folder_id = $1) AS workflow_count,\n       (SELECT COUNT(*) FROM instructions WHERE folder_id = $1) AS instruction_count,\n       (SELECT COUNT(*) FROM credentials  WHERE folder_id = $1) AS credential_count,\n       (SELECT COUNT(*) FROM folders      WHERE parent_id = $1) AS child_count`,
    [folderId],
  );

  return {
    workflow_count: Number(row?.workflow_count ?? 0),
    instruction_count: Number(row?.instruction_count ?? 0),
    credential_count: Number(row?.credential_count ?? 0),
    child_count: Number(row?.child_count ?? 0),
  };
}

export async function deleteFolderById(folderId: number): Promise<void> {
  await execute("DELETE FROM folders WHERE id = $1", [folderId]);
}

export async function listFolderShares(folderId: number): Promise<Array<FolderShare & { group_name: string }>> {
  const rows = await query<(FolderShareRow & { group_name: string })>(
    `SELECT fs.*, ug.name AS group_name\n       FROM folder_shares fs\n       JOIN user_groups ug ON ug.id = fs.group_id\n       WHERE fs.folder_id = $1\n       ORDER BY ug.name ASC`,
    [folderId],
  );
  return rows.map((row) => ({ ...normalizeFolderShare(row), group_name: row.group_name }));
}

export async function upsertFolderShare(input: {
  folderId: number;
  groupId: number;
  accessLevel: FolderShare["access_level"];
}): Promise<FolderShare | null> {
  await execute(
    `INSERT INTO folder_shares (folder_id, group_id, access_level)\n     VALUES ($1, $2, $3)\n     ON CONFLICT (folder_id, group_id)\n     DO UPDATE SET access_level = EXCLUDED.access_level`,
    [input.folderId, input.groupId, input.accessLevel],
  );
  const row = await queryOne<FolderShareRow>(
    "SELECT * FROM folder_shares WHERE folder_id = $1 AND group_id = $2",
    [input.folderId, input.groupId],
  );
  return row ? normalizeFolderShare(row) : null;
}
