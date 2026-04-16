import { decodeTimestamp } from "../value-codecs";
import { execute, insertAndReturnId, query, queryOne } from "@/lib/db";
import type { Credential, CredentialShare } from "@/lib/db";

interface CredentialRow extends Omit<Credential, "created_at" | "updated_at"> {
  created_at: string | Date;
  updated_at: string | Date;
}

interface CredentialShareRow extends Omit<CredentialShare, "created_at"> {
  created_at: string | Date;
}

function normalizeCredential(row: CredentialRow): Credential {
  return {
    ...row,
    created_at: decodeTimestamp(row.created_at) ?? new Date(0).toISOString(),
    updated_at: decodeTimestamp(row.updated_at) ?? new Date(0).toISOString(),
  };
}

function normalizeCredentialShare(row: CredentialShareRow): CredentialShare {
  return {
    ...row,
    created_at: decodeTimestamp(row.created_at) ?? new Date(0).toISOString(),
  };
}

export async function listCredentialsForVisibilityFilter(
  filterSql: string,
  filterParams: unknown[],
): Promise<Credential[]> {
  const rows = await query<CredentialRow>(
    `SELECT c.* FROM credentials c WHERE ${filterSql} ORDER BY c.updated_at DESC`,
    filterParams,
  );
  return rows.map(normalizeCredential);
}

export async function findPersonalWorkspaceByOwnerId(
  ownerId: number,
): Promise<number | null> {
  const row = await queryOne<{ id: number }>(
    "SELECT id FROM folders WHERE owner_id = $1 AND is_system = true AND name = 'My Workspace' LIMIT 1",
    [ownerId],
  );
  return row?.id ?? null;
}

export async function createCredential(input: {
  serviceName: string;
  description: string;
  secrets: string;
  ownerId: number;
  folderId: number;
}): Promise<Credential | null> {
  const id = await insertAndReturnId(
    `INSERT INTO credentials (service_name, description, secrets, owner_id, folder_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      input.serviceName,
      input.description,
      input.secrets,
      input.ownerId,
      input.folderId,
    ],
  );
  return findCredentialById(id);
}

export async function findCredentialById(
  id: number,
): Promise<Credential | null> {
  const row = await queryOne<CredentialRow>(
    "SELECT * FROM credentials WHERE id = $1",
    [id],
  );
  return row ? normalizeCredential(row) : null;
}

export async function updateCredentialById(input: {
  id: number;
  serviceName: string | null;
  description: string | null;
  secrets: string | null;
  folderId: number | null;
}): Promise<Credential | null> {
  await execute(
    `UPDATE credentials SET
       service_name = COALESCE($1, service_name),
       description = COALESCE($2, description),
       secrets = COALESCE($3, secrets),
       folder_id = COALESCE($4, folder_id),
       updated_at = $5
     WHERE id = $6`,
    [
      input.serviceName,
      input.description,
      input.secrets,
      input.folderId,
      new Date().toISOString(),
      input.id,
    ],
  );
  return findCredentialById(input.id);
}

export async function countCredentialNodeReferences(
  id: number,
): Promise<number> {
  const row = await queryOne<{ c: string | number }>(
    "SELECT COUNT(*) AS c FROM workflow_nodes WHERE credential_id = $1",
    [id],
  );
  return Number(row?.c ?? 0);
}

export async function deleteCredentialById(id: number): Promise<void> {
  await execute("DELETE FROM credentials WHERE id = $1", [id]);
}

export async function transferCredentialOwnership(input: {
  id: number;
  newOwnerId: number;
}): Promise<Credential | null> {
  await execute(
    "UPDATE credentials SET owner_id = $1, updated_at = $2 WHERE id = $3",
    [input.newOwnerId, new Date().toISOString(), input.id],
  );
  return findCredentialById(input.id);
}

export async function listCredentialShares(
  credentialId: number,
): Promise<Array<CredentialShare & { group_name: string }>> {
  const rows = await query<CredentialShareRow & { group_name: string }>(
    `SELECT cs.*, ug.name AS group_name
       FROM credential_shares cs
       JOIN user_groups ug ON ug.id = cs.group_id
       WHERE cs.credential_id = $1 ORDER BY ug.name ASC`,
    [credentialId],
  );
  return rows.map((row) => ({
    ...normalizeCredentialShare(row),
    group_name: row.group_name,
  }));
}

export async function upsertCredentialShare(input: {
  credentialId: number;
  groupId: number;
  accessLevel: CredentialShare["access_level"];
}): Promise<CredentialShare | null> {
  await execute(
    `INSERT INTO credential_shares (credential_id, group_id, access_level)
     VALUES ($1, $2, $3)
     ON CONFLICT (credential_id, group_id)
     DO UPDATE SET access_level = EXCLUDED.access_level`,
    [input.credentialId, input.groupId, input.accessLevel],
  );
  const row = await queryOne<CredentialShareRow>(
    "SELECT * FROM credential_shares WHERE credential_id = $1 AND group_id = $2",
    [input.credentialId, input.groupId],
  );
  return row ? normalizeCredentialShare(row) : null;
}
