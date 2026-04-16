import { query } from "@/lib/db";

function buildInClause(
  startIndex: number,
  values: number[],
): {
  clause: string;
  params: number[];
} {
  if (values.length === 0) {
    return { clause: "(NULL)", params: [] };
  }

  const placeholders = values.map((_, index) => `$${startIndex + index}`);
  return {
    clause: `(${placeholders.join(", ")})`,
    params: values,
  };
}

export async function listFolderShareLevelsForGroups(input: {
  folderId: number;
  groupIds: number[];
}): Promise<Array<{ access_level: "reader" | "contributor" }>> {
  if (input.groupIds.length === 0) return [];

  const groupFilter = buildInClause(2, input.groupIds);
  return query<{ access_level: "reader" | "contributor" }>(
    `SELECT fs.access_level
       FROM folder_shares fs
       JOIN folders f ON f.id = $1
       WHERE fs.folder_id IN (f.id, f.parent_id)
         AND fs.group_id IN ${groupFilter.clause}`,
    [input.folderId, ...groupFilter.params],
  );
}

export async function listWorkflowShareLevelsForGroups(input: {
  workflowId: number;
  groupIds: number[];
}): Promise<Array<{ access_level: "reader" | "contributor" }>> {
  if (input.groupIds.length === 0) return [];

  const groupFilter = buildInClause(2, input.groupIds);
  return query<{ access_level: "reader" | "contributor" }>(
    `SELECT access_level FROM workflow_shares
       WHERE workflow_id = $1 AND group_id IN ${groupFilter.clause}`,
    [input.workflowId, ...groupFilter.params],
  );
}

export async function listCredentialShareLevelsForGroups(input: {
  credentialId: number;
  groupIds: number[];
}): Promise<Array<{ access_level: "use" | "manage" }>> {
  if (input.groupIds.length === 0) return [];

  const groupFilter = buildInClause(2, input.groupIds);
  return query<{ access_level: "use" | "manage" }>(
    `SELECT access_level FROM credential_shares
      WHERE credential_id = $1 AND group_id IN ${groupFilter.clause}`,
    [input.credentialId, ...groupFilter.params],
  );
}
