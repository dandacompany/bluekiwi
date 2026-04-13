import { withTransaction } from "@/lib/db";
import type { PoolClient } from "pg";

export type DeleteMode = "transfer" | "delete_all";

export interface DeleteUserOptions {
  userId: number;
  mode: DeleteMode;
  transferTo?: number;
}

/**
 * Hard-delete a user and handle owned resources.
 *
 * - mode=transfer: reassign folders/workflows/instructions/credentials to transferTo
 * - mode=delete_all: delete all owned resources (cascading through related tables)
 *
 * Must be called after all auth/guard checks have passed.
 */
export async function deleteUser(opts: DeleteUserOptions): Promise<void> {
  const { userId, mode, transferTo } = opts;

  await withTransaction(async (client) => {
    if (mode === "transfer" && transferTo) {
      await transferResources(client, userId, transferTo);
    } else {
      await deleteResources(client, userId);
    }

    // Reset accepted invites so the same email can be re-invited
    await client.query("DELETE FROM invites WHERE accepted_by = $1", [userId]);

    // Delete the user — api_keys and user_group_members cascade automatically
    await client.query("DELETE FROM users WHERE id = $1", [userId]);
  });
}

async function transferResources(
  client: PoolClient,
  fromId: number,
  toId: number,
): Promise<void> {
  await client.query("UPDATE folders SET owner_id = $1 WHERE owner_id = $2", [
    toId,
    fromId,
  ]);
  await client.query("UPDATE workflows SET owner_id = $1 WHERE owner_id = $2", [
    toId,
    fromId,
  ]);
  await client.query(
    "UPDATE instructions SET owner_id = $1 WHERE owner_id = $2",
    [toId, fromId],
  );
  await client.query(
    "UPDATE credentials SET owner_id = $1 WHERE owner_id = $2",
    [toId, fromId],
  );
}

async function deleteResources(
  client: PoolClient,
  userId: number,
): Promise<void> {
  // 1. Collect IDs for targeted cleanup
  const { rows: wfRows } = await client.query<{ id: number }>(
    "SELECT id FROM workflows WHERE owner_id = $1",
    [userId],
  );
  const workflowIds = wfRows.map((r) => r.id);

  const { rows: credRows } = await client.query<{ id: number }>(
    "SELECT id FROM credentials WHERE owner_id = $1",
    [userId],
  );
  const credentialIds = credRows.map((r) => r.id);

  const { rows: instrRows } = await client.query<{ id: number }>(
    "SELECT id FROM instructions WHERE owner_id = $1",
    [userId],
  );
  const instructionIds = instrRows.map((r) => r.id);

  // 2. Delete tasks and their cascaded children (step_logs, approvals, comments, findings, artifacts)
  if (workflowIds.length > 0) {
    await client.query("DELETE FROM tasks WHERE workflow_id = ANY($1)", [
      workflowIds,
    ]);
  }

  // 3. Nullify node references to user's credentials/instructions before deleting them
  if (credentialIds.length > 0) {
    await client.query(
      "DELETE FROM node_credential_links WHERE credential_id = ANY($1)",
      [credentialIds],
    );
  }
  if (instructionIds.length > 0 && workflowIds.length > 0) {
    await client.query(
      "UPDATE workflow_nodes SET instruction_id = NULL WHERE instruction_id = ANY($1)",
      [instructionIds],
    );
  }

  // 4. Delete sharing records
  if (workflowIds.length > 0) {
    await client.query(
      "DELETE FROM workflow_shares WHERE workflow_id = ANY($1)",
      [workflowIds],
    );
  }
  if (credentialIds.length > 0) {
    await client.query(
      "DELETE FROM credential_shares WHERE credential_id = ANY($1)",
      [credentialIds],
    );
  }

  // 5. Delete owned resources (workflow_nodes cascade from workflows)
  if (workflowIds.length > 0) {
    await client.query(
      // Clear family references before deleting
      "UPDATE workflows SET parent_workflow_id = NULL, family_root_id = NULL WHERE owner_id = $1",
      [userId],
    );
    await client.query("DELETE FROM workflows WHERE owner_id = $1", [userId]);
  }

  if (instructionIds.length > 0) {
    await client.query("DELETE FROM instructions WHERE owner_id = $1", [
      userId,
    ]);
  }

  if (credentialIds.length > 0) {
    await client.query("DELETE FROM credentials WHERE owner_id = $1", [userId]);
  }

  // 6. Delete folders (folder_shares cascade from folders)
  // Delete child folders first, then parents
  await client.query(`DELETE FROM folders WHERE owner_id = $1`, [userId]);
}
